import "server-only";

import { createHash } from "node:crypto";
import { CheckoutQuoteStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/server/identity/current-session";
import { getCheckoutQuote } from "@/server/checkout/quotes";

const snapshotInput = z.object({
  addressId: z.string().trim().min(1).optional(),
  recipientName: z.string().trim().min(2).max(160).optional(),
  phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/).optional(),
  line1: z.string().trim().min(3).max(200).optional(),
  line2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(2).max(120).optional(),
  region: z.string().trim().max(120).optional().nullable(),
  postalCode: z.string().trim().max(32).optional().nullable(),
  saveToAddressBook: z.boolean().optional().default(false),
  label: z.string().trim().max(80).optional().nullable()
}).strict().superRefine((value, context) => {
  if (value.addressId) {
    if (value.recipientName || value.phone || value.line1 || value.city || value.region || value.postalCode) {
      context.addIssue({ code: "custom", message: "Choose a saved address or enter a new address, not both." });
    }
  } else {
    for (const key of ["recipientName", "phone", "line1", "city"] as const) {
      if (!value[key]) context.addIssue({ code: "custom", path: [key], message: "This field is required." });
    }
  }
});

type Owner = { userId: string } | { guestSessionId: string };
function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
function ownerWhere(owner: Owner) { return "userId" in owner ? { userId: owner.userId } : { guestSessionId: owner.guestSessionId }; }

async function resolveOwner(guestToken: string, now: Date): Promise<Owner> {
  const session = await getCurrentSession(now);
  if (session) return { userId: session.userId };
  const guest = await prisma.guestSession.findUnique({
    where: { tokenHash: hashToken(guestToken) },
    select: { id: true, expiresAt: true, convertedAt: true }
  });
  if (!guest || guest.expiresAt <= now || guest.convertedAt) throw new Error("Checkout session expired. Return to your cart and start again.");
  return { guestSessionId: guest.id };
}

export async function getCheckoutAddressOptions(guestToken: string, quoteId: string, now = new Date()) {
  const quote = await getCheckoutQuote(guestToken, quoteId, now);
  const owner = await resolveOwner(guestToken, now);
  const market = await prisma.market.findUniqueOrThrow({
    where: { code: quote.market.code },
    select: { country: { select: { iso2: true, name: true } } }
  });
  const savedAddresses = "userId" in owner
    ? await prisma.userAddress.findMany({
        where: { userId: owner.userId, country: { iso2: market.country.iso2, isActive: true } },
        include: { country: { select: { iso2: true, name: true } } },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
      })
    : [];
  return {
    quoteId,
    quoteStatus: quote.status,
    marketCountry: market.country,
    deliveryAddress: quote.deliveryAddress ?? null,
    savedAddresses: savedAddresses.map(({ country, ...address }) => ({
      ...address, countryCode: country.iso2, countryName: country.name
    }))
  };
}

export async function setCheckoutDeliveryAddress(guestToken: string, quoteId: string, input: unknown, now = new Date()) {
  const data = snapshotInput.parse(input);
  const currentQuote = await getCheckoutQuote(guestToken, quoteId, now);
  if (currentQuote.status !== CheckoutQuoteStatus.ACTIVE) throw new Error("This checkout quote is no longer active. Return to your cart.");
  const owner = await resolveOwner(guestToken, now);

  return prisma.$transaction(async (tx) => {
    const quote = await tx.checkoutQuote.findFirst({
      where: { id: quoteId, ...ownerWhere(owner), status: CheckoutQuoteStatus.ACTIVE, expiresAt: { gt: now } },
      include: { market: { include: { country: { select: { id: true, iso2: true, name: true, isActive: true } } } }
    });
    if (!quote || !quote.market.country.isActive) throw new Error("This checkout quote is no longer active.");

    let address: {
      sourceAddressId: string | null; recipientName: string; phone: string; countryCode: string;
      countryName: string; line1: string; line2: string | null; city: string;
      region: string | null; postalCode: string | null;
    };

    if (data.addressId) {
      if (!("userId" in owner)) throw new Error("Saved addresses are available only after signing in.");
      const saved = await tx.userAddress.findFirst({
        where: { id: data.addressId, userId: owner.userId, countryId: quote.market.country.id },
        select: { id: true, recipientName: true, phone: true, line1: true, line2: true, city: true, region: true, postalCode: true }
      });
      if (!saved) throw new Error("The selected saved address is unavailable for this market.");
      address = {
        sourceAddressId: saved.id, recipientName: saved.recipientName, phone: saved.phone,
        countryCode: quote.market.country.iso2, countryName: quote.market.country.name,
        line1: saved.line1, line2: saved.line2, city: saved.city, region: saved.region, postalCode: saved.postalCode
      };
    } else {
      if (!data.recipientName || !data.phone || !data.line1 || !data.city) throw new Error("Complete all required delivery address fields.");
      let sourceAddressId: string | null = null;
      if (data.saveToAddressBook && "userId" in owner) {
        const saved = await tx.userAddress.create({
          data: {
            userId: owner.userId, countryId: quote.market.country.id, label: data.label || null,
            recipientName: data.recipientName, phone: data.phone, line1: data.line1,
            line2: data.line2 || null, city: data.city, region: data.region || null,
            postalCode: data.postalCode || null
          },
          select: { id: true }
        });
        sourceAddressId = saved.id;
      }
      address = {
        sourceAddressId, recipientName: data.recipientName, phone: data.phone,
        countryCode: quote.market.country.iso2, countryName: quote.market.country.name,
        line1: data.line1, line2: data.line2 || null, city: data.city,
        region: data.region || null, postalCode: data.postalCode || null
      };
    }

    return tx.checkoutQuoteAddress.upsert({
      where: { quoteId },
      create: { quoteId, ...address },
      update: { ...address }
    });
  }, { isolationLevel: "Serializable" });
}
