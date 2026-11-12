

// "use client";

// import { useEffect, useRef, useState } from "react";
// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import MarketplaceSearchBox from "@/features/storefront/marketplace-search-box";
// import AuthReturnLink from "@/components/auth-return-link";
// import LanguageSwitcher from "@/components/language-switcher";
// import { useLocale } from "@/components/locale-provider";
// import { translate, type Locale } from "@/lib/locale";

// type AccountSummary = {
//   name: string;
//   accountType: string;
//   accountTypeError: string | null;
//   profileImageUrl: string | null;
// };

// const publicLinks = [
//   { href: "/", label: "Home" },
//   { href: "/products", label: "Shop" },
//   { href: "/categories", label: "Categories" },
//   { href: "/brands", label: "Brands" },
//   { href: "/stores", label: "Stores" },
//   { href: "/seller", label: "Sell on Mtjr" }
// ];

// function localizeAccountType(locale: Locale, accountType: string) {
//   const accountTypes: Record<string, string> = {
//     "Super Admin": "مدير عام",
//     Admin: "مدير",
//     Seller: "بائع",
//     Support: "الدعم",
//     "Seller applicant": "متقدم للبيع",
//     Customer: "عميل",
//     User: "مستخدم",
//     "Account type unavailable": "نوع الحساب غير متاح"
//   };
//   return locale === "ar" ? accountTypes[accountType] ?? accountType : accountType;
// }

// type NavigationIconName = "home" | "shop" | "grid" | "tag" | "store" | "sell" | "cart" | "heart" | "orders" | "messages" | "bell" | "admin" | "user" | "login" | "logout" | "about" | "contact" | "document" | "menu" | "chevron-down" | "chevron-up" | "close";

// function NavigationIcon({ name, className = "h-4 w-4" }: { name: NavigationIconName; className?: string }) {
//   const paths: Record<NavigationIconName, React.ReactNode> = {
//     home: <path d="m3 10 9-7 9 7M5 9v11h14V9M9 20v-7h6v7" />,
//     shop: <path d="M4 7h16l-1 14H5L4 7ZM8 7a4 4 0 0 1 8 0" />,
//     grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
//     tag: <path d="M20 13 13 20 3 10V3h7l10 10Z" />,
//     store: <path d="M3 10h18l-2-7H5l-2 7ZM5 10v11h14V10" />,
//     sell: <path d="m3 11 9-8 9 8v10H3V11" />,
//     cart: <><circle cx="9" cy="20" r="1.2" /><circle cx="18" cy="20" r="1.2" /><path d="M2 3h2l2.5 12h12L21 7H5" /></>,
//     heart: <path d="M20.8 8.8c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z" />,
//     orders: <path d="M7 3h10l3 3v15H4V3h3ZM8 11h8M8 15h8" />,
//     messages: <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4-.9L3 21l1.8-4.5A8.3 8.3 0 1 1 21 11.5Z" />,
//     bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />,
//     admin: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 9h8M8 13h5" /></>,
//     user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
//     login: <path d="m10 17 5-5-5-5M15 12H3M12 3h7v18h-7" />,
//     logout: <path d="m14 17 5-5-5-5M19 12H8M12 3H5v18h7" />,
//     about: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7h.01" /></>,
//     contact: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
//     document: <path d="M6 3h8l4 4v14H6zM14 3v5h5M9 13h6" />,
//     menu: <path d="M4 7h16M4 12h16M4 17h16" />,
//     "chevron-down": <path d="m5 7.5 5 5 5-5" />,
//     "chevron-up": <path d="m5 12.5 5-5 5 5" />,
//     close: <path d="m6 6 12 12M18 6 6 18" />
//   };
//   return <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
// }

// const navigationLabels: Record<string, { ar: string; icon: NavigationIconName }> = {
//   Home: { ar: "الرئيسية", icon: "home" }, Shop: { ar: "تسوق", icon: "shop" }, Categories: { ar: "الفئات", icon: "grid" }, Brands: { ar: "العلامات التجارية", icon: "tag" },
//   Stores: { ar: "المتاجر", icon: "store" }, "Sell on Mtjr": { ar: "بع على متجر", icon: "sell" }, About: { ar: "من نحن", icon: "about" }, Contact: { ar: "اتصل بنا", icon: "contact" },
//   Terms: { ar: "الشروط والأحكام", icon: "document" }, Privacy: { ar: "سياسة الخصوصية", icon: "document" }, Cart: { ar: "السلة", icon: "cart" }, Favorites: { ar: "المفضلة", icon: "heart" },
//   Orders: { ar: "الطلبات", icon: "orders" }, Messages: { ar: "الرسائل", icon: "messages" }, Notifications: { ar: "الإشعارات", icon: "bell" }, "Control panel": { ar: "لوحة التحكم", icon: "admin" },
//   "My profile": { ar: "ملفي الشخصي", icon: "user" }, "My account": { ar: "حسابي", icon: "user" }, "Sign in": { ar: "تسجيل الدخول", icon: "login" }, Join: { ar: "إنشاء حساب", icon: "user" }, "Sign out": { ar: "تسجيل الخروج", icon: "logout" }
// };

// function localizedNavigationLabel(locale: Locale, label: string) {
//   const item = navigationLabels[label];
//   return item ? translate(locale, label, item.ar) : label;
// }

// function navigationIconFor(label: string): NavigationIconName {
//   return navigationLabels[label]?.icon ?? "document";
// }

// function initials(name: string) {
//   return name
//     .trim()
//     .split(/\s+/)
//     .slice(0, 2)
//     .map((part) => part[0]?.toLocaleUpperCase() ?? "")
//     .join("") || "U";
// }

// function isSafeProfileImageUrl(value: string | null) {
//   if (!value) return false;
//   try {
//     return new URL(value).protocol === "https:";
//   } catch {
//     return false;
//   }
// }

// function Avatar({ account, size = "md" }: { account: AccountSummary; size?: "sm" | "md" }) {
//   const sizeClass = size === "sm" ? "h-9 w-9 text-xs" : "h-10 w-10 text-sm";
//   return (
//     <span
//       aria-hidden="true"
//       className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-orange-200 bg-gradient-to-br from-orange-50 to-white font-bold text-orange-600 shadow-sm ${sizeClass}`}
//     >
//       {isSafeProfileImageUrl(account.profileImageUrl) ? (
//         <img
//           src={account.profileImageUrl!}
//           alt=""
//           referrerPolicy="no-referrer"
//           className="h-full w-full object-cover"
//         />
//       ) : (
//         initials(account.name)
//       )}
//     </span>
//   );
// }

// export default function SiteNavigationContent({ account }: { account: AccountSummary | null }) {
//   const { locale } = useLocale();
//   const pathname = usePathname();
//   const isAdministrator = account?.accountType === "Admin" || account?.accountType === "Super Admin";
//   const controlPanelHref = account?.accountType === "Super Admin" ? "/admin/control-panel" : "/admin/dashboard";
  
//   const [mobileOpen, setMobileOpen] = useState(false);
//   const [accountOpen, setAccountOpen] = useState(false);
//   const [logoutBusy, setLogoutBusy] = useState(false);
//   const [logoutError, setLogoutError] = useState("");
  
//   const mobileMenuRef = useRef<HTMLDivElement>(null);
//   const accountMenuRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     function onPointerDown(event: PointerEvent) {
//       const target = event.target;
//       if (!(target instanceof Node)) return;
//       if (!mobileMenuRef.current?.contains(target)) setMobileOpen(false);
//       if (!accountMenuRef.current?.contains(target)) setAccountOpen(false);
//     }
//     function onKeyDown(event: KeyboardEvent) {
//       if (event.key === "Escape") {
//         setMobileOpen(false);
//         setAccountOpen(false);
//       }
//     }
//     document.addEventListener("pointerdown", onPointerDown);
//     document.addEventListener("keydown", onKeyDown);
//     return () => {
//       document.removeEventListener("pointerdown", onPointerDown);
//       document.removeEventListener("keydown", onKeyDown);
//     };
//   }, []);

//   async function logout() {
//     if (logoutBusy) return;
//     setLogoutBusy(true);
//     setLogoutError("");
//     try {
//       const response = await fetch("/api/auth/logout", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({}),
//         cache: "no-store"
//       });
//       const result = await response.json() as { error?: string };
//       if (!response.ok) throw new Error(result.error || "Unable to sign out right now.");
//       window.location.replace("/");
//     } catch (error) {
//       const message = error instanceof Error ? error.message : "Unable to sign out right now.";
//       setLogoutError(translate(locale, message, message === "Unable to sign out right now." ? "تعذر تسجيل الخروج الآن." : message));
//     } finally {
//       setLogoutBusy(false);
//     }
//   }

//   const signedInLinks = [
//     { href: "/account/messages", label: "Messages" },
//     { href: "/notifications", label: "Notifications" }
//   ];

//   const mobileQuickActions = account
//     ? [
//         { href: "/cart", label: "Cart", icon: "cart" as NavigationIconName },
//         { href: "/account/favorites", label: "Favorites", icon: "heart" as NavigationIconName },
//         { href: "/account/orders", label: "Orders", icon: "orders" as NavigationIconName },
//         { href: "/account/messages", label: "Messages", icon: "messages" as NavigationIconName }
//       ]
//     : [
//         { href: "/cart", label: "Cart", icon: "cart" as NavigationIconName }
//       ];

//   const mobileLinks = [
//     ...publicLinks,
//     ...(isAdministrator ? [{ href: controlPanelHref, label: "Control panel" }] : [])
//   ];

//   const menuLinkClass = "group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-600 transition-all duration-200 hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/20";

//   return (
//     <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] backdrop-blur-xl">
//       {/* Top subtle accent line */}
//       <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/30 to-transparent" />

//       <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
//         {/* Logo */}
//         <Link
//           href="/"
//           aria-label="Mtjr home"
//           className="group flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-1.5 transition hover:bg-gray-50"
//         >
//           <span className="text-2xl font-black tracking-tighter text-gray-900 transition-colors group-hover:text-gray-800">
//             mtjr<span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">.</span>
//           </span>
//         </Link>

//         {/* Search Box Wrapper */}
//         <div className="hidden flex-1 md:block">
//           <MarketplaceSearchBox />
//         </div>

//         {/* Desktop Actions */}
//         <div className="hidden shrink-0 items-center gap-2 md:ml-auto md:flex">
//           {isAdministrator && (
//             <Link
//               href={controlPanelHref}
//               className="clay-interactive inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
//             >
//               <NavigationIcon name="admin" />
//               <span className="hidden lg:inline">{localizedNavigationLabel(locale, "Control panel")}</span>
//             </Link>
//           )}

//           <Link
//             href="/cart"
//             className="relative inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2.5 text-gray-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
//             aria-label={localizedNavigationLabel(locale, "Cart")}
//           >
//             <NavigationIcon name="cart" className="h-5 w-5" />
//           </Link>

//           {account ? (
//             <div className="relative" ref={accountMenuRef}>
//               <button
//                 type="button"
//                 aria-expanded={accountOpen}
//                 aria-label={translate(locale, `Account menu for ${account.name}`, `قائمة حساب ${account.name}`)}
//                 onClick={() => {
//                   setAccountOpen((open) => !open);
//                   setLogoutError("");
//                 }}
//                 className="clay-interactive flex max-w-[min(42vw,14rem)] items-center gap-2.5 rounded-xl border border-gray-200 bg-white py-1.5 pl-1.5 pr-3 text-left text-gray-700 transition hover:border-orange-200 hover:bg-orange-50/50 hover:text-gray-900"
//               >
//                 <Avatar account={account} size="sm" />
//                 <span className="min-w-0 flex-1">
//                   <span className="block truncate text-sm font-bold text-gray-900">{account.name}</span>
//                   <span className="block text-[10px] font-medium text-gray-500">
//                     {localizeAccountType(locale, account.accountType)}
//                   </span>
//                 </span>
//                 <NavigationIcon name={accountOpen ? "chevron-up" : "chevron-down"} className="h-4 w-4 text-gray-400" />
//               </button>

//               {accountOpen && (
//                 <div
//                   role="menu"
//                   aria-label={translate(locale, "Account options", "خيارات الحساب")}
//                   className="absolute right-0 top-full z-50 mt-3 w-72 overflow-hidden rounded-2xl border border-gray-100 bg-white p-2 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)]"
//                 >
//                   {/* User Info Header */}
//                   <div className="mb-2 flex items-center gap-3 rounded-xl bg-gradient-to-br from-orange-50 to-white p-3">
//                     <Avatar account={account} />
//                     <span className="min-w-0 flex-1">
//                       <span className="block truncate text-sm font-bold text-gray-900">{account.name}</span>
//                       <span className="mt-0.5 block text-xs text-gray-500">{localizeAccountType(locale, account.accountType)}</span>
//                     </span>
//                   </div>

//                   {account.accountTypeError && (
//                     <p role="status" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
//                       {translate(locale, account.accountTypeError, "تعذر تحميل نوع حسابك.")}
//                     </p>
//                   )}

//                   <div className="space-y-0.5">
//                     <Link href="/account/profile" onClick={() => setAccountOpen(false)} className={menuLinkClass}>
//                       <NavigationIcon name="user" />{localizedNavigationLabel(locale, "My profile")}
//                     </Link>
//                     <Link href="/account" onClick={() => setAccountOpen(false)} className={menuLinkClass}>
//                       <NavigationIcon name="admin" />{localizedNavigationLabel(locale, "My account")}
//                     </Link>
//                     <div className="my-2 h-px bg-gray-100" />
//                     {logoutError && (
//                       <p role="alert" className="px-4 py-2 text-xs text-red-600">{logoutError}</p>
//                     )}
//                     <button
//                       type="button"
//                       disabled={logoutBusy}
//                       onClick={logout}
//                       className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-500 transition-all duration-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-60"
//                     >
//                       <NavigationIcon name="logout" />
//                       {logoutBusy ? translate(locale, "Signing out…", "جارٍ تسجيل الخروج…") : localizedNavigationLabel(locale, "Sign out")}
//                     </button>
//                   </div>
//                 </div>
//               )}
//             </div>
//           ) : (
//             <div className="flex items-center gap-2">
//               <AuthReturnLink
//                 href="/login"
//                 className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
//               >
//                 <NavigationIcon name="login" className="h-4 w-4" />
//                 {localizedNavigationLabel(locale, "Sign in")}
//               </AuthReturnLink>
//               <AuthReturnLink
//                 href="/register"
//                 className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-bold text-white shadow-[0_4px_16px_rgba(249,115,22,0.25)] transition-all hover:brightness-110 hover:shadow-[0_6px_20px_rgba(249,115,22,0.35)]"
//               >
//                 <NavigationIcon name="user" className="h-4 w-4" />
//                 {localizedNavigationLabel(locale, "Join")}
//               </AuthReturnLink>
//             </div>
//           )}
          
//           <div className="ml-1 border-l border-gray-200 pl-3">
//             <LanguageSwitcher />
//           </div>
//         </div>
//       </div>

//       {/* Desktop Navigation Links */}
//       <div className="hidden border-t border-gray-50 md:block">
//         <div className="mx-auto flex max-w-[1440px] items-center gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
//           {[...publicLinks, ...(account ? signedInLinks : [])].map((link) => {
//             const isActive = link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(link.href + "/");
//             return (
//               <Link
//                 key={link.href}
//                 href={link.href}
//                 aria-current={isActive ? "page" : undefined}
//                 className={`group relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors duration-300 ${
//                   isActive ? "text-gray-900" : "text-gray-500 hover:text-gray-900"
//                 }`}
//               >
//                 <NavigationIcon name={navigationIconFor(link.label)} className={`h-4 w-4 transition-colors ${isActive ? "text-orange-500" : "text-gray-400 group-hover:text-gray-600"}`} />
//                 {localizedNavigationLabel(locale, link.label)}
                
//                 {/* Active Indicator */}
//                 <span
//                   className={`absolute bottom-0 left-1/2 h-0.5 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300 ${
//                     isActive ? "w-1/2 shadow-[0_0_12px_rgba(249,115,22,0.4)]" : "w-0 group-hover:w-1/4"
//                   }`}
//                 />
//               </Link>
//             );
//           })}
//         </div>
//       </div>

//       {/* ============ MOBILE NAVIGATION ============ */}
//       <div className="absolute right-4 top-3 md:hidden" ref={mobileMenuRef}>
//         <button
//           type="button"
//           aria-label={translate(locale, mobileOpen ? "Close navigation menu" : "Open navigation menu", mobileOpen ? "إغلاق قائمة التنقل" : "فتح قائمة التنقل")}
//           aria-expanded={mobileOpen}
//           aria-controls="mobile-main-navigation"
//           onClick={() => setMobileOpen((open) => !open)}
//           className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
//         >
//           <NavigationIcon name={mobileOpen ? "close" : "menu"} className="h-5 w-5" />
//         </button>

//         {mobileOpen && (
//           <nav
//             id="mobile-main-navigation"
//             aria-label={translate(locale, "Main navigation", "القائمة الرئيسية")}
//             className="absolute right-0 top-full z-50 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)]"
//           >
//             {/* Mobile Header */}
//             <div className="flex items-center justify-between border-b border-gray-100 p-4">
//               <span className="text-lg font-black tracking-tight text-gray-900">
//                 mtjr<span className="text-orange-500">.</span>
//               </span>
//               <LanguageSwitcher compact />
//             </div>

//             <div className="max-h-[min(75dvh,40rem)] overflow-y-auto p-3 [scrollbar-width:thin]">
//               {/* Mobile User Info or Welcome */}
//               {account ? (
//                 <div className="mb-4 flex items-center gap-3 rounded-xl bg-gradient-to-br from-orange-50 to-white p-3">
//                   <Avatar account={account} />
//                   <span className="min-w-0 flex-1">
//                     <span className="block truncate text-sm font-bold text-gray-900">{account.name}</span>
//                     <span className="block text-xs text-gray-500">{localizeAccountType(locale, account.accountType)}</span>
//                   </span>
//                 </div>
//               ) : (
//                 <div className="mb-4 rounded-xl bg-gradient-to-br from-gray-50 to-white p-4 text-center">
//                   <span className="block text-sm font-semibold text-gray-700">{translate(locale, "Welcome to Mtjr", "مرحبًا بك في متجر")}</span>
//                   <div className="mt-3 flex gap-2">
//                     <AuthReturnLink href="/login" className="flex-1 rounded-lg border border-gray-200 bg-white py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50">
//                       {localizedNavigationLabel(locale, "Sign in")}
//                     </AuthReturnLink>
//                     <AuthReturnLink href="/register" className="flex-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 py-2 text-xs font-bold text-white shadow-md transition hover:brightness-110">
//                       {localizedNavigationLabel(locale, "Join")}
//                     </AuthReturnLink>
//                   </div>
//                 </div>
//               )}

//               {/* Quick Actions Grid (Only for signed in) */}
//               {account && mobileQuickActions.length > 0 && (
//                 <div className="mb-4 grid grid-cols-4 gap-2">
//                   {mobileQuickActions.map((action) => (
//                     <Link
//                       key={action.href}
//                       href={action.href}
//                       onClick={() => setMobileOpen(false)}
//                       className="flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-100 bg-white p-3 text-center transition hover:border-orange-200 hover:bg-orange-50"
//                     >
//                       <span className="grid size-8 place-items-center rounded-lg bg-gray-50 text-gray-600 transition group-hover:bg-orange-100 group-hover:text-orange-600">
//                         <NavigationIcon name={action.icon} className="h-5 w-5" />
//                       </span>
//                       <span className="text-[10px] font-medium text-gray-600">
//                         {localizedNavigationLabel(locale, action.label)}
//                       </span>
//                     </Link>
//                   ))}
//                 </div>
//               )}

//               {/* Main Links List */}
//               <div className="space-y-0.5 border-t border-gray-100 pt-3">
//                 {mobileLinks.map((link) => {
//                   const isActive = link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(link.href + "/");
//                   return (
//                     <Link
//                       key={link.href}
//                       href={link.href}
//                       onClick={() => setMobileOpen(false)}
//                       className={`group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
//                         isActive
//                           ? "bg-orange-50 text-orange-600"
//                           : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
//                       }`}
//                     >
//                       <NavigationIcon name={navigationIconFor(link.label)} className={`h-4 w-4 ${isActive ? "text-orange-500" : "text-gray-400"}`} />
//                       {localizedNavigationLabel(locale, link.label)}
//                       {isActive && <span className="ms-auto size-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />}
//                     </Link>
//                   );
//                 })}
//               </div>

//               {/* Mobile Logout (if signed in) */}
//               {account && (
//                 <div className="mt-4 border-t border-gray-100 pt-3">
//                   {logoutError && <p role="alert" className="mb-2 px-4 text-xs text-red-600">{logoutError}</p>}
//                   <button
//                     type="button"
//                     disabled={logoutBusy}
//                     onClick={() => {
//                       logout();
//                       setMobileOpen(false);
//                     }}
//                     className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-60"
//                   >
//                     <NavigationIcon name="logout" />
//                     {logoutBusy ? translate(locale, "Signing out…", "جارٍ تسجيل الخروج…") : localizedNavigationLabel(locale, "Sign out")}
//                   </button>
//                 </div>
//               )}
//             </div>
//           </nav>
//         )}
//       </div>
//     </header>
//   );
// }
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import MarketplaceSearchBox from "@/features/storefront/marketplace-search-box";
import AuthReturnLink from "@/components/auth-return-link";
import LanguageSwitcher from "@/components/language-switcher";
import { useLocale } from "@/components/locale-provider";
import { translate, type Locale } from "@/lib/locale";

type AccountSummary = {
  name: string;
  accountType: string;
  accountTypeError: string | null;
  profileImageUrl: string | null;
};

const publicLinks = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Shop" },
  { href: "/categories", label: "Categories" },
  { href: "/brands", label: "Brands" },
  { href: "/stores", label: "Stores" },
  { href: "/seller", label: "Sell on Mtjr" }
];

function localizeAccountType(locale: Locale, accountType: string) {
  const accountTypes: Record<string, string> = {
    "Super Admin": "مدير عام",
    Admin: "مدير",
    Seller: "بائع",
    Support: "الدعم",
    "Seller applicant": "متقدم للبيع",
    Customer: "عميل",
    User: "مستخدم",
    "Account type unavailable": "نوع الحساب غير متاح"
  };
  return locale === "ar" ? accountTypes[accountType] ?? accountType : accountType;
}

type NavigationIconName = "home" | "shop" | "grid" | "tag" | "store" | "sell" | "cart" | "heart" | "orders" | "messages" | "bell" | "admin" | "user" | "login" | "logout" | "about" | "contact" | "document" | "menu" | "chevron-down" | "chevron-up" | "close";

function NavigationIcon({ name, className = "h-4 w-4" }: { name: NavigationIconName; className?: string }) {
  const paths: Record<NavigationIconName, React.ReactNode> = {
    home: <path d="m3 10 9-7 9 7M5 9v11h14V9M9 20v-7h6v7" />,
    shop: <path d="M4 7h16l-1 14H5L4 7ZM8 7a4 4 0 0 1 8 0" />,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    tag: <path d="M20 13 13 20 3 10V3h7l10 10Z" />,
    store: <path d="M3 10h18l-2-7H5l-2 7ZM5 10v11h14V10" />,
    sell: <path d="m3 11 9-8 9 8v10H3V11" />,
    cart: <><circle cx="9" cy="20" r="1.2" /><circle cx="18" cy="20" r="1.2" /><path d="M2 3h2l2.5 12h12L21 7H5" /></>,
    heart: <path d="M20.8 8.8c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z" />,
    orders: <path d="M7 3h10l3 3v15H4V3h3ZM8 11h8M8 15h8" />,
    messages: <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4-.9L3 21l1.8-4.5A8.3 8.3 0 1 1 21 11.5Z" />,
    bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />,
    admin: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 9h8M8 13h5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    login: <path d="m10 17 5-5-5-5M15 12H3M12 3h7v18h-7" />,
    logout: <path d="m14 17 5-5-5-5M19 12H8M12 3H5v18h7" />,
    about: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7h.01" /></>,
    contact: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    document: <path d="M6 3h8l4 4v14H6zM14 3v5h5M9 13h6" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    "chevron-down": <path d="m5 7.5 5 5 5-5" />,
    "chevron-up": <path d="m5 12.5 5-5 5 5" />,
    close: <path d="m6 6 12 12M18 6 6 18" />
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const navigationLabels: Record<string, { ar: string; icon: NavigationIconName }> = {
  Home: { ar: "الرئيسية", icon: "home" }, Shop: { ar: "تسوق", icon: "shop" }, Categories: { ar: "الفئات", icon: "grid" }, Brands: { ar: "العلامات التجارية", icon: "tag" },
  Stores: { ar: "المتاجر", icon: "store" }, "Sell on Mtjr": { ar: "بع على متجر", icon: "sell" }, About: { ar: "من نحن", icon: "about" }, Contact: { ar: "اتصل بنا", icon: "contact" },
  Terms: { ar: "الشروط والأحكام", icon: "document" }, Privacy: { ar: "سياسة الخصوصية", icon: "document" }, Cart: { ar: "السلة", icon: "cart" }, Favorites: { ar: "المفضلة", icon: "heart" },
  Orders: { ar: "الطلبات", icon: "orders" }, Messages: { ar: "الرسائل", icon: "messages" }, Notifications: { ar: "الإشعارات", icon: "bell" }, "Control panel": { ar: "لوحة التحكم", icon: "admin" },
  "My profile": { ar: "ملفي الشخصي", icon: "user" }, "My account": { ar: "حسابي", icon: "user" }, "Sign in": { ar: "تسجيل الدخول", icon: "login" }, Join: { ar: "إنشاء حساب", icon: "user" }, "Sign out": { ar: "تسجيل الخروج", icon: "logout" }
};

function localizedNavigationLabel(locale: Locale, label: string) {
  const item = navigationLabels[label];
  return item ? translate(locale, label, item.ar) : label;
}

function navigationIconFor(label: string): NavigationIconName {
  return navigationLabels[label]?.icon ?? "document";
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? "")
    .join("") || "U";
}

function isSafeProfileImageUrl(value: string | null) {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function Avatar({ account, size = "md" }: { account: AccountSummary; size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "h-9 w-9 text-xs" : "h-10 w-10 text-sm";
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-orange-200 bg-gradient-to-br from-orange-50 to-white font-bold text-orange-600 shadow-sm ${sizeClass}`}
    >
      {isSafeProfileImageUrl(account.profileImageUrl) ? (
        <img
          src={account.profileImageUrl!}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      ) : (
        initials(account.name)
      )}
    </span>
  );
}

export default function SiteNavigationContent({ account }: { account: AccountSummary | null }) {
  const { locale } = useLocale();
  const pathname = usePathname();
  const isAdministrator = account?.accountType === "Admin" || account?.accountType === "Super Admin";
  const controlPanelHref = account?.accountType === "Super Admin" ? "/admin/control-panel" : "/admin/dashboard";
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!mobileMenuRef.current?.contains(target)) setMobileOpen(false);
      if (!accountMenuRef.current?.contains(target)) setAccountOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setAccountOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  async function logout() {
    if (logoutBusy) return;
    setLogoutBusy(true);
    setLogoutError("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        cache: "no-store"
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to sign out right now.");
      window.location.replace("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign out right now.";
      setLogoutError(translate(locale, message, message === "Unable to sign out right now." ? "تعذر تسجيل الخروج الآن." : message));
    } finally {
      setLogoutBusy(false);
    }
  }

  const signedInLinks = [
    { href: "/account/messages", label: "Messages" },
    { href: "/notifications", label: "Notifications" }
  ];

  const mobileQuickActions = account
    ? [
        { href: "/cart", label: "Cart", icon: "cart" as NavigationIconName },
        { href: "/account/favorites", label: "Favorites", icon: "heart" as NavigationIconName },
        { href: "/account/orders", label: "Orders", icon: "orders" as NavigationIconName },
        { href: "/account/messages", label: "Messages", icon: "messages" as NavigationIconName }
      ]
    : [
        { href: "/cart", label: "Cart", icon: "cart" as NavigationIconName }
      ];

  const mobileLinks = [
    ...publicLinks,
    ...(isAdministrator ? [{ href: controlPanelHref, label: "Control panel" }] : [])
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-stone-200/60 bg-white/95 shadow-sm backdrop-blur-xl">
      {/* خط علوي متدرج */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/40 to-transparent" />

      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        {/* الشعار */}
        <Link
          href="/"
          aria-label="Mtjr home"
          className="group flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-1.5 transition hover:bg-stone-50"
        >
          <span className="text-2xl font-black tracking-tighter text-stone-900 transition-colors group-hover:text-stone-800">
            mtjr<span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">.</span>
          </span>
        </Link>

        {/* صندوق البحث */}
        <div className="hidden flex-1 md:block">
          <MarketplaceSearchBox />
        </div>

        {/* الإجراءات على سطح المكتب */}
        <div className="hidden shrink-0 items-center gap-2 md:ml-auto md:flex">
          {isAdministrator && (
            <Link
              href={controlPanelHref}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
            >
              <NavigationIcon name="admin" />
              <span className="hidden lg:inline">{localizedNavigationLabel(locale, "Control panel")}</span>
            </Link>
          )}

          <Link
            href="/cart"
            className="relative inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white p-2.5 text-stone-600 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
            aria-label={localizedNavigationLabel(locale, "Cart")}
          >
            <NavigationIcon name="cart" className="h-5 w-5" />
          </Link>

          {account ? (
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                aria-expanded={accountOpen}
                aria-label={translate(locale, `Account menu for ${account.name}`, `قائمة حساب ${account.name}`)}
                onClick={() => {
                  setAccountOpen((open) => !open);
                  setLogoutError("");
                }}
                className="flex max-w-[min(42vw,14rem)] items-center gap-2.5 rounded-xl border border-stone-200 bg-white py-1.5 pl-1.5 pr-3 text-left text-stone-700 transition hover:border-orange-300 hover:bg-orange-50/50 hover:text-stone-900"
              >
                <Avatar account={account} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-stone-900">{account.name}</span>
                  <span className="block text-[10px] font-medium text-stone-500">
                    {localizeAccountType(locale, account.accountType)}
                  </span>
                </span>
                <NavigationIcon name={accountOpen ? "chevron-up" : "chevron-down"} className="h-4 w-4 text-stone-400" />
              </button>

              {accountOpen && (
                <div
                  role="menu"
                  aria-label={translate(locale, "Account options", "خيارات الحساب")}
                  className="absolute right-0 top-full z-50 mt-3 w-72 overflow-hidden rounded-2xl border border-stone-200 bg-white p-2 shadow-xl"
                >
                  {/* رأس معلومات المستخدم */}
                  <div className="mb-2 flex items-center gap-3 rounded-xl bg-gradient-to-br from-orange-50 to-white p-3">
                    <Avatar account={account} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-stone-900">{account.name}</span>
                      <span className="mt-0.5 block text-xs text-stone-500">{localizeAccountType(locale, account.accountType)}</span>
                    </span>
                  </div>

                  {account.accountTypeError && (
                    <p role="status" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                      {translate(locale, account.accountTypeError, "تعذر تحميل نوع حسابك.")}
                    </p>
                  )}

                  <div className="space-y-0.5">
                    <Link href="/account/profile" onClick={() => setAccountOpen(false)} className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-stone-600 transition-all duration-200 hover:bg-stone-50 hover:text-stone-900">
                      <NavigationIcon name="user" />{localizedNavigationLabel(locale, "My profile")}
                    </Link>
                    <Link href="/account" onClick={() => setAccountOpen(false)} className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-stone-600 transition-all duration-200 hover:bg-stone-50 hover:text-stone-900">
                      <NavigationIcon name="admin" />{localizedNavigationLabel(locale, "My account")}
                    </Link>
                    <div className="my-2 h-px bg-stone-100" />
                    {logoutError && (
                      <p role="alert" className="px-4 py-2 text-xs text-red-600">{logoutError}</p>
                    )}
                    <button
                      type="button"
                      disabled={logoutBusy}
                      onClick={logout}
                      className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-500 transition-all duration-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-60"
                    >
                      <NavigationIcon name="logout" />
                      {logoutBusy ? translate(locale, "Signing out…", "جارٍ تسجيل الخروج…") : localizedNavigationLabel(locale, "Sign out")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AuthReturnLink
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900"
              >
                <NavigationIcon name="login" className="h-4 w-4" />
                {localizedNavigationLabel(locale, "Sign in")}
              </AuthReturnLink>
              <AuthReturnLink
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-orange-500/25 transition-all hover:from-orange-600 hover:to-amber-600 hover:shadow-lg hover:shadow-orange-500/30"
              >
                <NavigationIcon name="user" className="h-4 w-4" />
                {localizedNavigationLabel(locale, "Join")}
              </AuthReturnLink>
            </div>
          )}
          
          <div className="ml-1 border-l border-stone-200 pl-3">
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      {/* ================= شريط التنقل السفلي (Desktop Navigation) ================= */}
      <div className="hidden border-t border-stone-100 md:block">
        <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
          {[...publicLinks, ...(account ? signedInLinks : [])].map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`group relative flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none ${
                  isActive
                    ? "border-transparent bg-orange-500 text-white shadow-[0_5px_14px_rgba(249,115,22,0.24)] hover:bg-orange-500 hover:text-white"
                    : "border-transparent bg-white text-stone-800 hover:border-orange-200 hover:bg-white hover:text-stone-950 hover:shadow-[0_4px_12px_rgba(249,115,22,0.10)]"
                }`}
              >
                <NavigationIcon 
                  name={navigationIconFor(link.label)} 
                  className={`h-4 w-4 transition-colors ${
                    isActive ? "text-white" : "text-stone-700 group-hover:text-orange-500"
                  }`} 
                />
                <span>{localizedNavigationLabel(locale, link.label)}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ================= التنقل على الموبايل ================= */}
      <div className="absolute right-4 top-3 md:hidden" ref={mobileMenuRef}>
        <button
          type="button"
          aria-label={translate(locale, mobileOpen ? "Close navigation menu" : "Open navigation menu", mobileOpen ? "إغلاق قائمة التنقل" : "فتح قائمة التنقل")}
          aria-expanded={mobileOpen}
          aria-controls="mobile-main-navigation"
          onClick={() => setMobileOpen((open) => !open)}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
        >
          <NavigationIcon name={mobileOpen ? "close" : "menu"} className="h-5 w-5" />
        </button>

        {mobileOpen && (
          <nav
            id="mobile-main-navigation"
            aria-label={translate(locale, "Main navigation", "القائمة الرئيسية")}
            className="absolute right-0 top-full z-50 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl"
          >
            {/* رأس الموبايل */}
            <div className="flex items-center justify-between border-b border-stone-100 p-4">
              <span className="text-lg font-black tracking-tight text-stone-900">
                mtjr<span className="text-orange-500">.</span>
              </span>
              <LanguageSwitcher compact />
            </div>

            <div className="max-h-[min(75dvh,40rem)] overflow-y-auto p-3">
              {/* معلومات المستخدم أو الترحيب */}
              {account ? (
                <div className="mb-4 flex items-center gap-3 rounded-xl bg-gradient-to-br from-orange-50 to-white p-3">
                  <Avatar account={account} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-stone-900">{account.name}</span>
                    <span className="block text-xs text-stone-500">{localizeAccountType(locale, account.accountType)}</span>
                  </span>
                </div>
              ) : (
                <div className="mb-4 rounded-xl bg-gradient-to-br from-stone-50 to-white p-4 text-center">
                  <span className="block text-sm font-semibold text-stone-700">{translate(locale, "Welcome to Mtjr", "مرحبًا بك في متجر")}</span>
                  <div className="mt-3 flex gap-2">
                    <AuthReturnLink href="/login" className="flex-1 rounded-lg border border-stone-200 bg-white py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-50">
                      {localizedNavigationLabel(locale, "Sign in")}
                    </AuthReturnLink>
                    <AuthReturnLink href="/register" className="flex-1 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 py-2 text-xs font-bold text-white shadow-md transition hover:from-orange-600 hover:to-amber-600">
                      {localizedNavigationLabel(locale, "Join")}
                    </AuthReturnLink>
                  </div>
                </div>
              )}

              {/* الإجراءات السريعة */}
              {account && mobileQuickActions.length > 0 && (
                <div className="mb-4 grid grid-cols-4 gap-2">
                  {mobileQuickActions.map((action) => (
                    <Link
                      key={action.href}
                      href={action.href}
                      onClick={() => setMobileOpen(false)}
                      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-stone-100 bg-white p-3 text-center transition hover:border-orange-200 hover:bg-orange-50"
                    >
                      <span className="grid size-8 place-items-center rounded-lg bg-stone-50 text-stone-600 transition hover:bg-orange-100 hover:text-orange-600">
                        <NavigationIcon name={action.icon} className="h-5 w-5" />
                      </span>
                      <span className="text-[10px] font-medium text-stone-600">
                        {localizedNavigationLabel(locale, action.label)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {/* قائمة الروابط الرئيسية */}
              <div className="space-y-0.5 border-t border-stone-100 pt-3">
                {mobileLinks.map((link) => {
                  const isActive = link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(link.href + "/");
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={`group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 ${
                        isActive
                          ? "border border-transparent bg-orange-500 text-white shadow-[0_5px_14px_rgba(249,115,22,0.22)]"
                          : "border border-transparent bg-white text-stone-800 hover:border-orange-200 hover:bg-white hover:text-stone-950 hover:shadow-[0_4px_12px_rgba(249,115,22,0.10)]"
                      }`}
                    >
                      <NavigationIcon 
                        name={navigationIconFor(link.label)} 
                        className={`h-4 w-4 transition-colors ${
                          isActive ? "text-white" : "text-stone-400 group-hover:text-orange-500"
                        }`} 
                      />
                      <span>{localizedNavigationLabel(locale, link.label)}</span>
                      {isActive && (
                        <span className="ms-auto size-2 rounded-full bg-white shadow-sm" />
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* زر تسجيل الخروج */}
              {account && (
                <div className="mt-4 border-t border-stone-100 pt-3">
                  {logoutError && <p role="alert" className="mb-2 px-4 text-xs text-red-600">{logoutError}</p>}
                  <button
                    type="button"
                    disabled={logoutBusy}
                    onClick={() => {
                      logout();
                      setMobileOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-60"
                  >
                    <NavigationIcon name="logout" />
                    {logoutBusy ? translate(locale, "Signing out…", "جارٍ تسجيل الخروج…") : localizedNavigationLabel(locale, "Sign out")}
                  </button>
                </div>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}