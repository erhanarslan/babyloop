export const locales = ["en", "tr"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "tr";

export const dictionaries = {
  en: {
    common: {
      babyloop: "BabyLoop",
      loading: "Loading",
      browseMarketplace: "Browse marketplace",
      createListing: "Create listing",
      viewMyListings: "View my listings",
      login: "Login",
      register: "Register",
      logout: "Logout",
      email: "Email",
      password: "Password",
      displayName: "Display name",
      city: "City",
      backToLogin: "Back to login",
      apiUnavailable: "BabyLoop API is unavailable.",
      requestFailed: "Request failed. Please try again.",
      loginRequired: "Please log in to continue.",
      accessDenied: "You do not have access to this action.",
      notFound: "The requested item was not found.",
      language: "Language",
      theme: "Theme",
      light: "Light",
      dark: "Dark",
      priceOnRequest: "Price on request",
      viewDetails: "View details",
      backToBrowse: "Back to browse",
      notProvided: "Not provided"
    },
    publicShell: {
      header: {
        allCategories: "All categories",
        assistant: "Assistant",
        browse: "Browse",
        close: "Close",
        location: "Location",
        locationAria: "Choose marketplace location",
        loginUnlocks: "Login unlocks messages, favorites, saved searches, and selling.",
        menu: "Menu",
        messages: "Messages",
        notifications: "Notifications",
        openMenu: "Open menu",
        popularSearches: "Popular searches",
        recentSearches: "Recent searches",
        clearRecent: "Clear",
        filterTitle: "Refine results",
        filterSale: "For sale",
        filterDonation: "Donation",
        filterSwap: "Swap",
        filterImages: "With photos",
        filterNew: "New",
        filterLikeNew: "Like new",
        savedSearches: "Saved searches",
        searchPlaceholder: "Stroller, car seat, high chair...",
        searchTitle: "What are you looking for?",
        sell: "Sell",
        settingsComingSoon: "Coming soon",
        suggestedCategories: "Suggested categories",
        viewResults: "View results"
      },
      accountMenu: {
        profile: "My profile",
        myListings: "My listings",
        sellerDashboard: "Seller dashboard",
        messages: "Messages",
        notifications: "Notifications",
        savedSearches: "Saved searches",
        childProfiles: "Child needs",
        favorites: "Favorites",
        security: "Security and password",
        logout: "Logout"
      },
      location: {
        allTurkey: "All Turkey",
        current: "Current location",
        helper: "City filtering is carried in the browse URL while backend matching is expanded.",
        selectCity: "Select city",
        selected: "{city} selected.",
        unsupported: "Your browser does not support location sharing.",
        locating: "Getting your location.",
        locatingButton: "Getting location...",
        useCurrent: "Use my location"
      },
      categoryGroups: {
        travel: "Strollers & travel",
        safety: "Car seats & safety",
        sleep: "Nursery & sleep",
        feeding: "Feeding",
        clothing: "Baby clothing",
        play: "Toys & books",
        care: "Bath & care",
        parent: "Parent products",
        kids: "3-7 years",
        reuse: "Donation / swap / free"
      },
      locationOptions: {
        turkiye: "All Turkey",
        istanbul: "Istanbul",
        ankara: "Ankara",
        izmir: "Izmir",
        bursa: "Bursa",
        antalya: "Antalya",
        konya: "Konya",
        kocaeli: "Kocaeli",
        sakarya: "Sakarya",
        eskisehir: "Eskisehir",
        adana: "Adana"
      },
      categoryLinks: {
        stroller: "Stroller",
        pushchair: "Pushchair",
        carrycot: "Carrycot",
        babyCarrier: "Baby carrier",
        travelSystem: "Travel system",
        carSeat: "Car seat",
        infantSeat: "Infant seat",
        safetyGate: "Safety gate",
        babyMonitor: "Baby monitor",
        crib: "Crib",
        playpen: "Playpen",
        sleepSack: "Sleep sack",
        nursery: "Nursery",
        highChair: "High chair",
        bottle: "Bottle",
        sterilizer: "Sterilizer",
        breastPump: "Breast pump",
        zeroToThreeMonths: "0-3 months",
        oneYearClothes: "1 year",
        twoYearCoat: "2 year coat",
        babyShoes: "Shoes",
        montessoriToy: "Montessori toy",
        educationalToy: "Educational toy",
        childrenBook: "Book",
        puzzle: "Puzzle",
        babyBath: "Baby bath",
        diaperChanging: "Diaper changing",
        careBag: "Care bag",
        maternityWear: "Maternity wear",
        nursingProducts: "Nursing products",
        parentGuides: "Parent guides",
        threeToSevenToy: "3-7 years toy",
        bike: "Bike",
        scooter: "Scooter",
        preschool: "Preschool",
        freeBabyClothes: "Free baby clothes",
        donation: "Donation",
        swap: "Swap"
      },
      quickCategoryLinks: {
        parentGuide: "Parent guide",
        childNeeds: "My child",
        assistant: "Assistant",
        parentReviews: "Parent reviews"
      },
      popularSearchTerms: [
        "Stroller",
        "Car seat",
        "High chair",
        "Playpen",
        "Montessori toy",
        "2 year coat",
        "Free baby clothes"
      ]

    },
    publicPages: {
      home: {
        heroEyebrow: "BabyLoop marketplace",
        heroTitle: "Find baby and child essentials near you.",
        heroBody: "Search parent-owned strollers, car seats, toys, clothes, donation items, and swap-ready needs in one focused marketplace.",
        sellCta: "List an item",
        browseCta: "Browse listings",
        marketHeroLabel: "BabyLoop marketplace home",
        marketHeroTitle: "Discover baby and child items nearby",
        marketHeroBody: "Browse fresh listings or pass along what your family no longer uses.",
        latestListingsTitle: "Latest listings",
        latestListingsLoading: "Loading latest listings",
        latestListingsEmpty: "No fresh listings yet",
        latestListingsUnavailable: "Latest listings are unavailable",
        carouselLabel: "BabyLoop marketplace highlights",
        carouselControls: "Hero banner controls",
        previousSlide: "Previous",
        nextSlide: "Next",
        slideLabel: "Show slide {index}",
        trendsLabel: "Trending searches",
        heroSlides: [
          {
            title: "Find baby essentials faster",
            body: "Discover strollers, car seats, toys, and more from families.",
            cta: "Browse listings",
            href: "/browse",
            tone: "discover",
            visualPrimary: "Stroller",
            visualSecondary: "Car seat",
            visualTertiary: "Toy set"
          },
          {
            title: "Turn unused items into listings",
            body: "List baby and child products in minutes.",
            cta: "List an item",
            href: "/sell",
            tone: "sell",
            visualPrimary: "Clean photos",
            visualSecondary: "Quick listing",
            visualTertiary: "Ready"
          },
          {
            title: "Catch free and budget-friendly finds",
            body: "Find donation, swap, and affordable products in one place.",
            cta: "See free items",
            href: "/browse?q=%C3%BCcretsiz",
            tone: "reuse",
            visualPrimary: "Free clothes",
            visualSecondary: "Swap",
            visualTertiary: "Budget"
          }
        ],
        popularTitle: "Popular searches",
        categoriesTitle: "Shop by need",
        trustTitle: "A calmer second-hand flow",
        trustBody: "Message inside BabyLoop, keep contact details private, and use reports only when something feels unsafe."
      },
      browse: {
        title: "Marketplace results",
        subtitle: "Search, filter, and open the listing that fits your family need.",
        filters: "Filters",
        category: "Category",
        search: "Search",
        type: "Type",
        condition: "Condition",
        minPrice: "Min price",
        maxPrice: "Max price",
        imagesOnly: "Images only",
        sort: "Sort",
        sortNewest: "Newest",
        sortOldest: "Oldest",
        sortPriceAsc: "Price low to high",
        sortPriceDesc: "Price high to low",
        apply: "Apply",
        clear: "Clear",
        allCategories: "All categories",
        allTypes: "All types",
        allConditions: "All conditions",
        activeFilters: "Active filters",
        resultCount: "Showing {shown} of {total} listings",
        noResultsTitle: "No listings match this search yet",
        noResultsBody: "Try a broader term, remove one filter, or save the need for later.",
        saveSearch: "Save search"
      },
      listingDetail: {
        back: "Back to results",
        messageSeller: "Message seller",
        favorite: "Favorite",
        report: "Report listing",
        seller: "Seller",
        details: "Details",
        safety: "Quick safety check",
        safetyBody: "Confirm condition, included parts, pickup expectations, and safety-sensitive history before meeting.",
        askAssistant: "Ask what to check",
        related: "More like this"
      },
      messaging: {
        inboxTitle: "Messages",
        inboxBody: "Open unread threads and keep item questions inside BabyLoop.",
        threadTitle: "Conversation",
        safetyMenu: "Safety actions",
        reportUser: "Report user",
        blockUser: "Block user",
        reportMessage: "Report message",
        context: "Listing context",
        composerTitle: "Message",
        composerHint: "Ask about condition, included parts, photos, or pickup timing."
      },
      account: {
        hubTitle: "My account",
        hubBody: "Manage marketplace shortcuts, seller tools, family planning, and account security.",
        profileSummary: "Profile summary",
        marketplaceShortcuts: "Marketplace shortcuts",
        sellerTools: "Seller tools",
        familyPlanning: "Family planning",
        security: "Security",
        preferences: "Preferences",
        payments: "Payment tools",
        notificationPreferences: "Notification preferences",
        comingSoon: "Coming soon"
      },
      support: {
        compactBoundary: "Marketplace guidance only. BabyLoop does not replace professional medical, safety, or legal advice.",
        guidesTitle: "Parent guides",
        assistantTitle: "BabyLoop Assistant"
      }
    },
    nav: {
      tagline: "Parent marketplace",
      searchLabel: "Search",
      searchHint: "Strollers, car seats, toys...",
      searchPlaceholder: "Search listings",
      searchHelp: "Type at least 3 characters",
      searchLoading: "Searching listings...",
      searchEmpty: "No matching listings found.",
      searchViewAll: "View results",
      home: "Home",
      marketplace: "Marketplace",
      sell: "Sell",
      account: "Account",
      browseListings: "Browse listings",
      browseDescription: "Find practical family essentials",
      favorites: "Favorites",
      favoritesDescription: "Saved listings from other parents",
      messages: "Messages",
      messagesDescription: "Talk with buyers and sellers",
      notifications: "Notifications",
      notificationsDescription: "See marketplace and message updates",
      notificationsWithCount: "Notifications ({count})",
      myListings: "My listings",
      myListingsDescription: "Review your marketplace activity",
      verifyEmail: "Verify email",
      changePassword: "Change password",
      mobileMenu: "Menu"
    },
    home: {
      eyebrow: "Baby and family essentials",
      title: "A trusted loop for baby essentials, parent guidance, and safer second-hand discovery.",
      subtitle:
        "BabyLoop connects marketplace listings, seller tools, child age-band planning, parent guides, and assistant-led buying checks so families can reuse essentials with more confidence.",
      heroPrimaryLoggedOut: "Create account",
      heroSecondaryLoggedOut: "Login",
      heroThird: "Browse marketplace",
      heroPrimaryLoggedIn: "Browse marketplace",
      heroSecondaryLoggedIn: "Create listing",
      heroThirdLoggedIn: "View my listings",
      previewStatus: "Live marketplace",
      previewTitle: "Gently used stroller",
      previewDescription: "Clean condition, parent-owned, ready for local pickup.",
      previewPrice: "TRY 3,250",
      previewCategory: "Strollers",
      previewTrust: "Verified parent account",
      howEyebrow: "How it works",
      howTitle: "A complete loop for everyday family items.",
      howDescription:
        "BabyLoop keeps discovery, listing creation, favorites, saved searches, messaging, and safety actions connected across the parent journey.",
      steps: [
        {
          title: "Find essentials",
          body: "Browse baby gear, toys, clothes, and nursery items with category, condition, price, photo, and status context."
        },
        {
          title: "List with confidence",
          body: "Create a listing with practical details, condition, price, photos, and AI-assisted preparation when helpful."
        },
        {
          title: "Talk before you meet",
          body: "Use built-in messaging, buyer checks, reporting, and blocking to keep next steps inside a safer marketplace flow."
        }
      ],
      categoriesEyebrow: "Marketplace flows",
      categoriesTitle: "Built around parent decisions, lifecycle needs, and trustworthy reuse.",
      categoriesDescription:
        "BabyLoop organizes discovery around sale, donation, and swap-ready essentials while connecting guides, saved searches, child profiles, and assistant prompts to the same journey.",
      categoryCards: [
        {
          title: "Baby gear",
          body: "Strollers, seats, carriers, and nursery pieces that families often outgrow quickly."
        },
        {
          title: "Toys and books",
          body: "Everyday learning items with clearer descriptions and condition notes."
        },
        {
          title: "Clothes and bundles",
          body: "Reusable seasonal items grouped in a way parents can scan quickly."
        }
      ],
      safetyEyebrow: "Trust and safety",
      safetyTitle: "A calmer marketplace for parents.",
      safetyDescription:
        "BabyLoop keeps ownership, account state, favorites, messages, reports, blocks, moderation cases, and audit-sensitive admin actions connected to privacy-aware profiles.",
      safetyItems: [
        "Parent-owned accounts and authenticated write actions",
        "Privacy-safe listing details that separate condition, type, seller, and location",
        "Participant-only messaging, reporting, blocking, moderation, and audit-aware review"
      ],
      finalTitle: "Ready to give baby essentials another loop?",
      finalDescription: "Start by browsing trusted listings, planning family needs, asking the assistant, or creating a clear listing for the next parent."
    },
    auth: {
      loginTitle: "Welcome back",
      loginDescription: "Sign in to save listings, message sellers, and manage your items.",
      registerTitle: "Create your BabyLoop account",
      registerDescription: "Join a parent-friendly marketplace for reusable family essentials.",
      forgotTitle: "Reset your password",
      forgotDescription: "Prepare a secure password reset for your BabyLoop account.",
      resetTitle: "Choose a new password",
      resetDescription: "Use your reset link to secure your BabyLoop account.",
      verifyTitle: "Verify email",
      verifyDescription: "Confirm the email address linked to your BabyLoop account.",
      requestVerifyTitle: "Verify your email",
      requestVerifyDescription: "Send a fresh verification link to your account email.",
      callbackTitle: "Signing you in",
      callbackDescription: "Finalizing your BabyLoop session.",
      changePasswordTitle: "Change password",
      changePasswordDescription: "Update your password for email-based BabyLoop login.",
      continueGoogle: "Continue with Google",
      openingGoogle: "Opening Google...",
      googleUnavailable: "Google sign-in is not configured in this environment.",
      divider: "or",
      noAccount: "No account yet?",
      createOne: "Create one",
      alreadyRegistered: "Already registered?",
      forgotPassword: "Forgot your password?",
      requestReset: "Request a reset",
      submitLogin: "Login",
      submitRegister: "Create account",
      submitting: "Submitting...",
      accountFailed: "Account request failed",
      requiredFields: "Please complete the required fields.",
      registerNote: "Your profile is created with your account.",
      loginNote: "Use your email and password to continue.",
      registrationSuccess: "Registration successful",
      emailDevLink:
        "Email delivery is not connected yet. Use this local development link to verify the account.",
      verifyLocally: "Verify email locally",
      emailWillBeRequired:
        "Registration successful. Email verification will be required when email delivery is configured.",
      verificationRequestGeneric:
        "If this email belongs to an account that needs verification, we’ll prepare a verification email.",
      emailVerificationDevTitle: "Local email verification link",
      resetPrepared: "Request prepared",
      resetGeneric:
        "If an account exists for this email, password reset instructions have been prepared.",
      resetDevTitle: "Local reset token",
      resetDevBody: "Email delivery is not connected yet. Use this local token to test the reset form.",
      resetSecurityNote: "Reset tokens are single-use and expire after a short time.",
      resetNoReveal: "This response does not reveal whether an account exists.",
      preparing: "Preparing...",
      requestResetButton: "Request reset",
      newPassword: "New password",
      confirmNewPassword: "Confirm new password",
      tokenMissing: "Reset token missing",
      tokenMissingBody: "Open the reset link generated for your account, or request a new password reset.",
      passwordsDoNotMatch: "Passwords do not match.",
      passwordTooShort: "New password must be at least 8 characters.",
      changePassword: "Change password",
      loginBeforePasswordChange: "Please log in before changing your password.",
      currentPasswordRequired: "Enter your current password.",
      currentPassword: "Current password",
      passwordChangeFailed: "Password could not be changed",
      passwordChangeNote: "Changing your password will sign out other active sessions for your account.",
      changing: "Changing...",
      passwordReset: "Password reset",
      passwordResetBody: "Your password was changed. You can now login with the new password.",
      passwordChangedTitle: "Password changed",
      passwordChangedBody: "Your password was changed. Please login again with your new password.",
      googleFailedTitle: "Google login failed",
      googleFailedBody: "Google authentication could not be completed. Please try again or use email and password.",
      googleUnavailableTitle: "Google sign-in unavailable",
      googleUnavailableBody: "Google sign-in is not configured in this environment. Please use email and password.",
      verificationMissing: "Verification token missing",
      verificationMissingBody: "Open the verification link generated for your account.",
      requestVerification: "Send verification link",
      verificationRequestSent: "Verification email requested",
      verificationLinkSafetyNote: "Verification links expire shortly. Do not use a request that is not yours or share the link with anyone.",
      verifyingEmail: "Verifying email",
      verifyingEmailBody: "BabyLoop is checking your verification token.",
      emailVerified: "Email verified",
      emailVerifiedBody: "Email verified successfully.",
      verificationFailed: "Verification failed",
      verificationFailedBody: "Verification link is invalid or expired.",
      requestNewVerification: "Request a new verification link",
      authModalTabsLabel: "Sign-in choice",
      authModalEyebrow: "BABYLOOP",
      fullName: "Full name",
      locationPlaceholder: "Istanbul",
      changePasswordEyebrow: "Password",
      changePasswordFormTitle: "Update your password",
      changePasswordFormDescription: "After changing your password, you need to sign in again.",
      passwordSessionRenewedTitle: "Session is refreshed",
      passwordSafeUseTitle: "Safe usage",
      passwordSafeUseBody: "Do not share your password in messages, listings, or assistant prompts.",
      forgotFormEyebrow: "Account recovery",
      forgotFormTitle: "Request a password reset safely",
      forgotFormDescription: "Enter your account email. BabyLoop uses a neutral response pattern so this page does not reveal whether an account exists.",
      recoveryLinksTitle: "Do not share links",
      recoveryLinksBody: "Recovery links and local development tokens should only be used by the account owner.",
      afterResetTitle: "After reset",
      afterResetBody: "Sign in again and avoid using shared devices for marketplace messages or seller tools.",
      resetFormEyebrow: "Set new password",
      resetFormTitle: "Choose a unique password",
      resetFormDescription: "Use a password you do not use on other sites. Do not paste recovery tokens or credentials into BabyLoop messages, listings, or assistant prompts.",
      resetNextStepTitle: "Next step",
      resetNextStepBody: "Sign in with the new password and avoid reusing the old credential elsewhere.",
      singleUseTokenTitle: "Single-use token",
      resetAfterSubmitBody: "Return to login and confirm that private account pages open correctly.",
      requestVerificationEyebrow: "Email verification",
      requestVerificationTitle: "Request a fresh verification link",
      requestVerificationDescription: "Check your inbox and spam folder after sending the link.",
      verificationInProgressTitle: "Verification in progress",
      verificationInProgressBody: "BabyLoop is validating the token before enabling account-only confidence signals.",
      verifiedTitle: "Verified",
      verifiedBody: "You can now return to login and continue using private BabyLoop account features.",
      expiredVerificationTitle: "Expired or invalid link",
      expiredVerificationBody: "Request a fresh verification link from BabyLoop instead of reusing old forwarded links."
    },
    authSurfaceGuide: {
      login: {
        ariaLabel: "Login guidance",
        eyebrow: "Secure access",
        title: "Continue with your protected BabyLoop account",
        description:
          "Use your account to manage listings, messages, favorites, saved searches, child age-band needs, and assistant guidance.",
        badge: "Cookie session",
        steps: [
          "Access is handled with cookie-backed sessions rather than persistent browser storage.",
          "After signing in, use the menu to reach marketplace and account tools.",
          "Keep sensitive contact details out of public listing text, messages, and assistant prompts."
        ],
        actions: [
          { href: "/browse", label: "Browse" },
          { href: "/assistant", label: "Ask Assistant" },
          { href: "/register", label: "Create account" }
        ]
      },
      register: {
        ariaLabel: "Registration guidance",
        eyebrow: "Create account",
        title: "Start with privacy-conscious marketplace tools",
        description:
          "Create an account to sell items, message safely, save filters, and get age-band based marketplace suggestions.",
        badge: "Privacy-first",
        steps: [
          "BabyLoop avoids exact child birth dates for lifecycle suggestions.",
          "Seller and buyer surfaces are separated to reduce unnecessary identity exposure.",
          "Use clear profile and listing information without adding private contact details."
        ],
        actions: [
          { href: "/browse", label: "Explore first" },
          { href: "/guides", label: "Read guides" },
          { href: "/login", label: "I have an account" }
        ]
      },
      forgot_password: {
        ariaLabel: "Account recovery guidance",
        eyebrow: "Account recovery",
        title: "Recover access safely",
        description:
          "Use the recovery flow when you cannot access your account. After recovery, review account settings and avoid shared-device sessions.",
        badge: "Recovery",
        steps: [
          "Use the official BabyLoop recovery page only.",
          "After changing credentials, sign out on shared devices.",
          "Never share recovery links or codes with another person."
        ],
        actions: [
          { href: "/login", label: "Back to login" },
          { href: "/guides", label: "Parent guides" }
        ]
      },
      reset_password: {
        ariaLabel: "Password reset guidance",
        eyebrow: "Set new password",
        title: "Choose a stronger password before continuing",
        description:
          "After reset, BabyLoop continues using protected session handling and account-level safety checks.",
        badge: "Password",
        steps: [
          "Use a unique password that is not reused elsewhere.",
          "Avoid storing credentials in screenshots, notes, or messages.",
          "Return to marketplace tools after confirming the reset."
        ],
        actions: [
          { href: "/login", label: "Sign in" },
          { href: "/browse", label: "Browse" }
        ]
      },
      verify: {
        ariaLabel: "Verification guidance",
        eyebrow: "Verification",
        title: "Finish account verification",
        description:
          "Verification keeps account actions clearer and helps protect marketplace interactions.",
        badge: "Verify",
        steps: [
          "Complete verification before relying on account-only features.",
          "Use messages for item questions and handover expectations.",
          "Report suspicious or misleading marketplace behavior."
        ],
        actions: [
          { href: "/login", label: "Login" },
          { href: "/guides", label: "Guides" }
        ]
      },
      change_password: {
        ariaLabel: "Password change guidance",
        eyebrow: "Account security",
        title: "Update your password deliberately",
        description:
          "Use this page when you want to rotate credentials or secure your account after using a shared device.",
        badge: "Security",
        steps: [
          "Use a unique password and keep it separate from marketplace messages.",
          "After changing it, confirm that login and logout still behave correctly.",
          "Review messages and listings if you suspect account misuse."
        ],
        actions: [
          { href: "/account/seller", label: "Seller dashboard" },
          { href: "/my-listings", label: "My listings" },
          { href: "/notifications", label: "Notifications" }
        ]
      }
    },
    accountSurfaceGuide: {
      my_listings: {
        eyebrow: "Listing management",
        title: "Keep every listing clear and actionable",
        description:
          "Review status, update condition, open the public page, and use seller insights before deciding whether to reserve, mark sold, or refresh a listing.",
        badge: "Seller workflow",
        steps: [
          "Check title, photos, condition, price, and included accessories.",
          "Use archive, restore, reserved, and sold actions intentionally.",
          "Open the public listing after major edits to verify the buyer view."
        ],
        actions: [
          { href: "/sell", label: "Create listing" },
          { href: "/account/seller", label: "Seller dashboard" },
          { href: "/guides", label: "Parent guides" }
        ]
      },
      favorites: {
        eyebrow: "Favorites",
        title: "Turn saved items into better decisions",
        description:
          "Favorites are a shortlist. Compare condition, photos, seller answers, and related guide topics before messaging.",
        badge: "Buyer workflow",
        steps: [
          "Revisit favorites that match current age-band or seasonal needs.",
          "Remove sold or irrelevant listings to keep the list useful.",
          "Use listing detail questions before committing to a handover."
        ],
        actions: [
          { href: "/browse", label: "Browse more" },
          { href: "/guides", label: "Buying guides" },
          { href: "/assistant", label: "Ask Assistant" }
        ]
      },
      saved_searches: {
        eyebrow: "Saved searches",
        title: "Reuse filters for recurring needs",
        description:
          "Saved searches help parents track size, season, price, and category needs without starting from scratch each time.",
        badge: "Retention",
        steps: [
          "Create one saved search per need, not one huge generic search.",
          "Use price and image filters when the item requires closer review.",
          "Notification delivery is intentionally separate and can be added later."
        ],
        actions: [
          { href: "/browse", label: "Create from browse" },
          { href: "/account/children", label: "Age-band needs" },
          { href: "/assistant", label: "Ask Assistant" }
        ]
      },
      notifications: {
        eyebrow: "Notifications",
        title: "Review marketplace updates from one place",
        description:
          "Use notifications to catch messages, listing interactions, and account updates without exposing buyer identities unnecessarily.",
        badge: "Inbox",
        steps: [
          "Open unread items first and clear the queue after review.",
          "Use conversation safety guidance for message-related notifications.",
          "Favorite and listing activity stays privacy-safe by default."
        ],
        actions: [
          { href: "/conversations", label: "Messages" },
          { href: "/notifications", label: "Notifications" },
          { href: "/account/notification-preferences", label: "Preferences" }
        ]
      },
      seller_dashboard: {
        eyebrow: "Seller dashboard",
        title: "Use aggregate insight without exposing buyers",
        description:
          "Seller dashboard shows performance signals only. Buyer identity, private contact details, and message text should not be exposed here.",
        badge: "Privacy-safe",
        steps: [
          "Watch favorites, views, listing clicks, and contact intents together.",
          "Improve listings with weak photos, unclear condition, or low contact intent.",
          "Use AI draft and price guidance as a starting point, not an autopublish flow."
        ],
        actions: [
          { href: "/sell", label: "Create listing" },
          { href: "/my-listings", label: "Manage listings" },
          { href: "/assistant", label: "Ask Assistant" }
        ]
      }
    },
    mobileNavigation: {
      drawerLabel: "BabyLoop mobile navigation",
      brandHomeLabel: "BabyLoop home",
      quickLinksLabel: "Mobile marketplace links",
      sellAuthTitle: "Sign in to create a listing"
    },
    authPageShell: {
      assuranceLabel: "Authentication safety summary",
      assuranceTitle: "Designed for safer marketplace access",
      assuranceBody: "BabyLoop keeps account actions separated from public browsing and avoids exposing private recovery state.",
      checklistLabel: "Account safety checklist",
      checklistEyebrow: "Safety checklist",
      checklistTitle: "Before continuing",
      callback: {
        badge: "Session",
        eyebrow: "Authentication",
        checks: [
          "Finalizes the provider callback",
          "Refreshes the protected session",
          "Redirects only after session validation"
        ]
      },
      forgot: {
        badge: "Recovery",
        eyebrow: "Account recovery",
        checks: [
          "Does not reveal whether an account exists",
          "Uses official BabyLoop recovery flow",
          "Recovery links and tokens must stay private"
        ]
      },
      login: {
        badge: "Secure access",
        eyebrow: "Account sign in",
        checks: [
          "Cookie-backed session handling",
          "Access token is kept in memory",
          "Protected actions use authenticated requests"
        ]
      },
      password: {
        badge: "Security",
        eyebrow: "Account security",
        checks: [
          "Requires the current password",
          "Ends active refresh sessions after change",
          "Keeps credentials out of messages and listings"
        ]
      },
      register: {
        badge: "Private profile",
        eyebrow: "Account creation",
        checks: [
          "Creates a marketplace profile",
          "Email verification can be completed separately",
          "Child planning uses age bands, not exact birth dates"
        ]
      },
      requestVerify: {
        badge: "Verification",
        eyebrow: "Email verification",
        checks: [
          "Uses an official verification request",
          "Does not expose account existence unnecessarily",
          "Verification links should not be shared"
        ]
      },
      reset: {
        badge: "New password",
        eyebrow: "Password reset",
        checks: [
          "Reset token is single-use",
          "New password should be unique",
          "Return to login after completion"
        ]
      },
      verify: {
        badge: "Verify",
        eyebrow: "Email verification",
        checks: [
          "Checks the verification token",
          "Finishes account confirmation",
          "Requests a new link when expired"
        ]
      }
    },
    accountProfile: {
      ariaLabel: "My account",
      pageTitle: "My account",
      pageDescription: "Manage marketplace shortcuts, seller tools, and security settings from one place.",
      sectionsLabel: "Account sections",
      loadingTitle: "Loading account details",
      loadFailedTitle: "Account details could not be loaded",
      sectionFastAccessDescription: "Open the areas you use often.",
      comingSoon: "Coming soon",
      comingSoonAria: "{label} coming soon",
      profileSummaryDescription: "Review the basic information shown on your account.",
      name: "Full name",
      city: "City",
      securityAndPassword: "Security center",
      securityDescription: "Manage your password, email OTP / MFA, and active device sessions.",
      securityPasswordDescription: "Update your password and keep your account safe.",
      otpDescription: "Second verification step for sign-ins.",
      mobileApprovalDescription: "Confirm new sign-ins with mobile approval.",
      trustedDevicesDescription: "Trusted devices will appear here later.",
      preferencesDescription: "Notification and payment settings will open here when ready.",
      notificationPreferencesDescription: "Manage child profile, saved search, and marketplace notifications.",
      paymentTools: "Payment tools",
      paymentToolsDescription: "Payment tools are not active inside BabyLoop yet.",
      menuItems: {
        profile: {
          label: "Profile summary",
          description: "Name, city, and account security"
        },
        marketplace: {
          label: "Marketplace shortcuts",
          description: "Favorites, messages, and notifications"
        },
        seller: {
          label: "Seller tools",
          description: "Create listings and manage seller space"
        },
        family: {
          label: "Family needs",
          description: "Child profiles, guides, and assistant"
        },
        security: {
          label: "Security",
          description: "Password and upcoming protections"
        },
        preferences: {
          label: "Preferences",
          description: "Notification and payment settings"
        },
        deletion: {
          label: "Delete account",
          description: "Permanently close your BabyLoop account"
        }
      },
      links: {
        favorites: {
          label: "Favorites",
          description: "Return to listings you saved."
        },
        savedSearches: {
          label: "Saved searches",
          description: "Manage searches and filters you follow."
        },
        messages: {
          label: "Messages",
          description: "Open buyer and seller conversations."
        },
        notifications: {
          label: "Notifications",
          description: "Review message and listing activity."
        },
        sell: {
          label: "Create listing",
          description: "List a new baby or child item."
        },
        myListings: {
          label: "My listings",
          description: "Manage active and archived listings."
        },
        sellerDashboard: {
          label: "Seller dashboard",
          description: "Track seller flow and listing status."
        },
        children: {
          label: "Child profiles / needs",
          description: "Keep child needs in a simple profile."
        },
        guides: {
          label: "Parent guides",
          description: "Read short and calm parent guidance."
        },
        assistant: {
          label: "Assistant",
          description: "Ask BabyLoop Assistant a short question."
        }
      }
    },
    notificationsArchive: {
      pageTitle: "Notifications",
      pageDescription: "Review message and listing activity here.",
      loadingTitle: "Loading notifications",
      loadingMessage: "Preparing message and listing activity.",
      unavailableTitle: "Notifications could not be loaded",
      actionFailedTitle: "Action could not be completed",
      unreadMessage: "Unread messages",
      goToMessages: "Go to messages",
      favoriteActivity: "Favorite activity",
      favoriteSummary: "{count} users added your products to favorites",
      favoriteMovementsLabel: "Favorite activity",
      favoritesTitle: "Favorites",
      favoriteStat: "{total} favorites · Today +{today}",
      noFavoriteActivity: "No favorite activity yet.",
      recentLabel: "Recent notifications",
      recentTitle: "Recent activity",
      noNotificationsTitle: "No notifications yet",
      noNotificationsBody: "Messages or listing activity will appear here.",
      unread: "Unread",
      open: "Open"
    },
    savedSearches: {
      ariaLabel: "Saved searches",
      filtersLabel: "Saved search filters",
      title: "Saved searches",
      description: "Manage the searches you saved.",
      actionFailedTitle: "Action could not be completed",
      loadingTitle: "Loading saved searches",
      loadingMessage: "Preparing your saved filters.",
      emptyTitle: "No saved searches yet",
      emptyMessage: "Save a search from Browse and reopen it here later.",
      emptyFilterTitle: "No searches in this filter",
      emptyFilterMessage: "Choose another filter or browse listings.",
      browseAction: "Browse listings",
      noFilters: "No filters",
      allListings: "All listings",
      notificationsOn: "Notifications on",
      notificationsOff: "Notifications off",
      openSearch: "Open search",
      updating: "Updating...",
      deleting: "Deleting...",
      delete: "Delete",
      turnNotificationsOn: "Turn notifications on",
      turnNotificationsOff: "Turn notifications off",
      selectedCategory: "Category selected",
      imageOnly: "With images only",
      filters: {
        all: "All saved searches",
        notifications_on: "Notifications on",
        notifications_off: "Notifications off"
      },
      chips: {
        query: "Search: {value}",
        type: "Type: {value}",
        condition: "Condition: {value}",
        minPrice: "Min: {value}",
        maxPrice: "Max: {value}",
        sort: "Sort: {value}"
      }
    },
    footer: {
      description: "A parent-friendly marketplace for giving baby and child essentials another useful loop.",
      marketplace: "Marketplace",
      account: "Account",
      support: "Support",
      browse: "Browse listings",
      sell: "Create listing",
      favorites: "Favorites",
      messages: "Messages",
      login: "Login",
      register: "Register",
      verifyEmail: "Verify email",
      resetPassword: "Reset password"
    },
    listings: {
      categoryNames: {
        "car-seats": "Car Seats",
        "montessori-toys": "Montessori Toys",
        strollers: "Strollers",
        toys: "Toys"
      },
      listingTypes: {
        sale: "For sale",
        swap: "Swap",
        donation: "Donation"
      },
      conditions: {
        new: "New",
        like_new: "Like new",
        good: "Good",
        fair: "Fair",
        needs_repair: "Needs repair"
      },
      statuses: {
        active: "Active",
        draft: "Draft",
        reserved: "Reserved",
        sold: "Sold",
        archived: "Archived"
      },
      sellEyebrow: "Sell on BabyLoop",
      sellTitle: "Create a trusted BabyLoop listing",
      sellDescription:
        "Prepare condition notes, photos, pickup context, included parts, and price details so parents can decide with confidence before they message you.",
      createAriaLabel: "Create listing form",
      listingsUnavailable: "Listings are unavailable",
      category: "Category",
      noCategoriesAvailable: "No categories available",
      listingType: "Listing type",
      title: "Title",
      titlePlaceholder: "Stokke stroller in good condition",
      description: "Description",
      descriptionPlaceholder: "Add condition notes, included pieces, and pickup details.",
      priceAmount: "Price amount",
      currency: "Currency",
      condition: "Condition",
      images: "Images",
      uploadImage: "Upload image",
      imageLimitHelp: "You can upload up to 5 images.",
      unsupportedImageType: "This file type is not supported.",
      imageTooLarge: "Image is too large.",
      tooManyImages: "This listing already has the maximum number of images.",
      deleteImage: "Delete image",
      uploading: "Uploading...",
      imageUploadFailed: "Image upload failed.",
      imageAuthenticityRejected: "This image does not look suitable for the listing. Please upload a clear, real photo of the actual product.",
      imageAuthenticityUnavailable: "Image safety review could not be completed right now. Please try again in a few minutes.",
      imageNeedsReviewTitle: "Image sent for review",
      imageNeedsReviewBody: "Your image was uploaded, but it may stay hidden until a short review is completed.",
      requiredFields: "Please complete the required fields.",
      loginBeforeCreate: "Please log in before creating a listing.",
      createFailed: "Listing could not be created",
      formTrustNote: "Publish only after the details, photos, price, and privacy checks are clear.",
      suggestListingDetails: "Suggest listing details",
      suggesting: "Suggesting...",
      creating: "Creating...",
      aiSuggestionUnavailable: "AI suggestion unavailable",
      aiNeedsDetails: "Add at least one listing detail before requesting a suggestion.",
      aiUnavailableManual: "AI suggestion is unavailable. You can continue manually.",
      aiSuggestionLabel: "AI listing suggestion",
      aiSuggestionTitle: "AI suggestion",
      suggestedTagsLabel: "Suggested tags",
      confidence: "confidence",
      myListingsEyebrow: "Seller workspace",
      myListingsTitle: "Seller listing management",
      myListingsDescription: "Review listing quality, availability, public visibility, images, price, and lifecycle actions for your seller workspace.",
      myListingsAriaLabel: "My listings",
      loginToViewMyListings: "Please log in to view your listings.",
      loadingMyListings: "Loading your listings",
      myListingsUnavailable: "Listings unavailable",
      noListingsTitle: "No listings yet.",
      noListingsBody: "Create your first BabyLoop listing, then return here to manage images, price, status, and buyer-facing quality.",
      sellItem: "Sell an item",
      editListing: "Edit",
      saveChanges: "Save changes",
      saving: "Saving...",
      cancelEdit: "Cancel",
      markReserved: "Mark reserved",
      markSold: "Mark sold",
      archiveListing: "Archive",
      reactivateListing: "Reactivate",
      notPublic: "Not public",
      lifecycleActionFailed: "Listing action failed",
      lifecycleActionsAriaLabel: "Listing lifecycle actions",
      imageMetadata: "Image metadata",
      noImage: "No image",
      browseEyebrow: "Browse marketplace",
      browseTitle: "Browse trusted baby essentials",
      browseResultsTitle: "Results for \"{query}\"",
      browseDescription:
        "Find baby and child items from parent-owned listings. Save favorites or open a listing to message the seller.",
      browseAriaLabel: "Browse listings",
      categoriesTitle: "Categories",
      categoriesAriaLabel: "Category filter placeholder",
      categoriesNote: "Use categories to understand what is available in the marketplace.",
      categoriesUnavailable: "Categories are not available right now.",
      noActiveListingsTitle: "No active listings yet.",
      noActiveListingsBody:
        "There are no matching listings yet. Try a different search or browse again later.",
      noProductImage: "No product image",
      productImageAlt: "{title} product image",
      typeLabel: "Type",
      conditionLabel: "Condition",
      statusLabel: "Status",
      favoriteCount: "Favorites: {count}",
      loadingListingsTitle: "Loading listings",
      fetchingMarketplaceTitle: "Fetching marketplace data",
      fetchingMarketplaceMessage: "Reading active listings and categories from the BabyLoop API.",
      detailEyebrow: "Listing detail",
      detailUnavailableTitle: "Listing unavailable",
      detailNotFoundTitle: "Listing not found",
      detailNotFoundDescription:
        "The listing may be inactive, removed, or not available in the current seed data.",
      loadingDetailTitle: "Loading listing",
      fetchingDetailTitle: "Fetching listing detail",
      fetchingDetailMessage: "Reading this listing from the BabyLoop API.",
      imageGalleryAriaLabel: "Listing image gallery",
      detailImageAlt: "{title} product image {index}",
      imageUnavailable: "Image unavailable",
      noPhotosTitle: "No photos added.",
      noPhotosBody: "Ask the seller for more photos before making a decision.",
      browseListings: "Browse listings",
      noDescription: "No description provided yet.",
      listingActionsAriaLabel: "Listing actions",
      location: "Location",
      created: "Created",
      updated: "Updated",
      sellerInformationAriaLabel: "Seller information",
      seller: "Seller",
      locationNotProvided: "Location not provided"
    },
    messaging: {
      eyebrow: "Messages",
      conversationsTitle: "Conversations",
      conversationsDescription: "Keep buyer and seller messages in one conversation per profile pair.",
      conversationTitle: "Conversation",
      conversationWith: "Conversation with",
      listing: "Listing",
      noListingContext: "No listing context",
      lastMessage: "Last message",
      updated: "Updated",
      created: "Created",
      loadingConversations: "Loading conversations",
      loginToViewConversations: "Please log in to view your conversations.",
      loginRequired: "Login required",
      messagesUnavailable: "Messages unavailable",
      noConversationsTitle: "No conversations yet.",
      noConversationsBody: "Start from a listing detail page by messaging a seller.",
      open: "Open",
      statusLabel: "Status",
      noMessagesSent: "No messages have been sent yet.",
      loadingConversation: "Loading conversation",
      loginToViewConversation: "Please log in to view this conversation.",
      backToMessages: "Back to messages",
      accessDenied: "Access denied",
      conversationNotFound: "Conversation not found",
      conversationUnavailable: "Conversation unavailable",
      noMessagesYet: "No messages yet.",
      sendFirstMessage: "Send the first message below.",
      you: "You",
      deletedMessage: "This message was deleted.",
      messageLabel: "Message",
      messagePlaceholder: "Write a short message",
      emptyMessage: "Message cannot be empty.",
      messageBlocked: "This message cannot be sent because it includes inappropriate content.",
      invalidMessageBody: "Messages can only contain safe plain text. HTML or scripts are not allowed.",
      sendFailed: "Message not sent",
      participantsOnly: "Messages are visible to conversation participants only.",
      sending: "Sending...",
      sendMessage: "Send message",
      newMessages: "New messages",
      unreadConversation: "Unread conversation",
      loginToMessageSeller: "Login to message seller",
      checkingSeller: "Checking seller",
      ownListing: "This is your listing",
      opening: "Opening...",
      messageSeller: "Message seller",
      messagingUnavailable: "Messaging unavailable"
    },
    notifications: {
      eyebrow: "Notifications",
      title: "Notification center",
      description: "Review message, listing, and marketplace updates for your BabyLoop profile.",
      loading: "Loading notifications",
      unavailable: "Notification center unavailable",
      unreadCount: "{count} unread notifications",
      markAsRead: "Mark as read",
      markAllRead: "Mark all as read",
      markingAllRead: "Marking...",
      read: "Read",
      emptyTitle: "No notifications yet.",
      emptyBody: "New message and marketplace updates will appear here.",
      actionFailed: "Notification action failed",
      messageReceived: "New message",
      listingFavorited: "Listing favorited",
      listingFavoritedBody: "Someone favorited your listing.",
      listingStatusChanged: "Listing status changed",
      viewConversation: "View conversation",
      viewListing: "View listing",
      typeLabels: {
        message_received: "Message",
        listing_favorited: "Favorite",
        listing_status_changed: "Listing status",
        system: "System"
      }
    },
    safety: {
      safetyActionsAriaLabel: "Safety actions",
      reportListing: "Report listing",
      reportUser: "Report user",
      reportMessage: "Report message",
      blockUser: "Block user",
      unblockUser: "Unblock",
      userBlocked: "User blocked.",
      userUnblocked: "User unblocked.",
      cannotMessageUser: "You cannot message this user.",
      cannotBlockSelf: "You cannot block yourself.",
      cannotReportSelf: "You cannot report yourself.",
      messagingBlockedTitle: "Messaging blocked",
      reason: "Reason",
      details: "Details",
      detailsPlaceholder: "Add optional context for the moderation team.",
      submitReport: "Submit report",
      submitting: "Submitting...",
      cancel: "Cancel",
      updating: "Updating...",
      reportSubmittedTitle: "Report submitted",
      reportSubmitted: "Report submitted.",
      actionComplete: "Action complete",
      actionFailed: "Safety action failed",
      reasons: {
        safety: "Safety concern",
        scam: "Scam or suspicious behavior",
        inappropriate: "Inappropriate content",
        prohibited_item: "Prohibited item",
        harassment: "Harassment",
        other: "Other"
      }
    },
    marketplace: {
      favoritesTitle: "Saved listing shortlist",
      favoritesDescription: "Compare saved listings, clean up stale items, and prepare better buyer questions before messaging sellers.",
      favoritesLogin: "Please log in to view your saved listings.",
      favoritesUnavailable: "Favorites unavailable",
      favoritesEmptyTitle: "No saved listings yet.",
      favoritesEmptyBody: "Browse the marketplace, open listing details, and save items you want to compare before messaging.",
      loadingFavorites: "Loading saved listings",
      favoritesEyebrow: "Your profile",
      favoritesAriaLabel: "Favorite listings",
      savedDate: "Saved {date}",
      favoriteActionFailed: "Favorite action failed",
      favoriteLoginRequired: "Please log in before saving favorites.",
      savingFavorite: "Saving...",
      favorite: "Favorite",
      unfavorite: "Unfavorite"
    },
    admin: {
      title: "BabyLoop Admin",
      description: "Minimal admin workspace for moderation and safety operations.",
      backToAdmin: "Back to admin",
      backToMarketplace: "Back to marketplace",
      auth: {
        checkingTitle: "Admin",
        checkingBody: "Checking admin access...",
        requiredTitle: "Admin access required",
        requiredBody: "You need to sign in before opening the admin area.",
        forbiddenTitle: "Forbidden",
        forbiddenBody: "Your account does not have admin permissions.",
        currentRole: "Current role",
        checkFailedTitle: "Admin access check failed",
        checkFailedBody: "BabyLoop could not verify your admin permissions.",
        signIn: "Sign in"
      },
      moderation: {
        title: "Moderation",
        description: "Review reported listings, profiles, and messages. Update case status and add audit notes.",
        openCases: "Open moderation cases",
        casesTitle: "Moderation cases",
        casesDescription: "Review reported marketplace content and keep an audit trail for each moderation case.",
        all: "All",
        pending: "Pending",
        inReview: "In review",
        resolved: "Resolved",
        dismissed: "Dismissed",
        loadingCases: "Loading moderation cases...",
        loadCasesFailedTitle: "Could not load moderation cases",
        noCasesTitle: "No moderation cases found",
        noCasesBody: "There are no cases for the selected filter.",
        openCase: "Open case",
        caseLabel: "Case",
        status: "Status",
        subject: "Subject",
        reason: "Reason",
        details: "Details",
        created: "Created",
        updated: "Updated",
        caseTitle: "Moderation case",
        loadingCase: "Loading moderation case...",
        loadCaseFailedTitle: "Could not load moderation case",
        backToCases: "Back to moderation cases",
        auditActionsTitle: "Audit actions",
        auditActionsDescription: "Status changes and admin notes for this moderation case.",
        noAuditActions: "No audit actions found for this case yet.",
        type: "Type",
        note: "Note",
        adminUser: "Admin user",
        updateStatusTitle: "Update status",
        updateStatusDescription: "Move this moderation case through the review workflow.",
        updateStatus: "Update status",
        updating: "Updating...",
        statusUpdated: "Moderation case status updated.",
        addActionTitle: "Add admin action",
        addActionDescription: "Add a moderation note or audit action. This does not perform destructive moderation by itself.",
        actionType: "Action type",
        adminNote: "Admin note",
        adminNotePlaceholder: "Write a short audit note for this moderation case.",
        adminNoteRequired: "Admin note is required.",
        addAction: "Add action",
        adding: "Adding...",
        actionAdded: "Admin action added to the audit trail.",
        actionTaken: "Action taken",
        reviewStarted: "Review started"
      }
    }
  },
  tr: {
    common: {
      babyloop: "BabyLoop",
      loading: "Yükleniyor",
      browseMarketplace: "Pazarı keşfet",
      createListing: "İlan oluştur",
      viewMyListings: "İlanlarım",
      login: "Giriş yap",
      register: "Hesap oluştur",
      logout: "Çıkış yap",
      email: "E-posta",
      password: "Şifre",
      displayName: "Görünen ad",
      city: "Şehir",
      backToLogin: "Girişe dön",
      apiUnavailable: "BabyLoop API şu anda erişilebilir değil.",
      requestFailed: "İstek başarısız oldu. Lütfen tekrar dene.",
      loginRequired: "Devam etmek için lütfen giriş yap.",
      accessDenied: "Bu işlem için erişimin yok.",
      notFound: "İstenen öğe bulunamadı.",
      language: "Dil",
      theme: "Tema",
      light: "Açık",
      dark: "Koyu",
      priceOnRequest: "Fiyat isteğe bağlı",
      viewDetails: "Detayları gör",
      backToBrowse: "Keşfe dön",
      notProvided: "Belirtilmedi"
    },
    publicShell: {
      header: {
        allCategories: "Tüm kategoriler",
        assistant: "Asistan",
        browse: "Keşfet",
        close: "Kapat",
        location: "Konum",
        locationAria: "Pazar konumunu seç",
        loginUnlocks: "Giriş yapınca mesajlar, favoriler, kayıtlı aramalar ve satış açılır.",
        menu: "Menü",
        messages: "Mesajlar",
        notifications: "Bildirimler",
        openMenu: "Menüyü aç",
        popularSearches: "Popüler aramalar",
        recentSearches: "Son aramalar",
        clearRecent: "Temizle",
        filterTitle: "Sonuçları daralt",
        filterSale: "Satılık",
        filterDonation: "Bağış",
        filterSwap: "Takas",
        filterImages: "Görselli ilanlar",
        filterNew: "Yeni",
        filterLikeNew: "Az kullanılmış",
        savedSearches: "Kayıtlı aramalar",
        searchPlaceholder: "Bebek arabası, oto koltuğu, mama sandalyesi...",
        searchTitle: "Ne arıyorsun?",
        sell: "İlan ver",
        settingsComingSoon: "Yakında",
        suggestedCategories: "Önerilen kategoriler",
        viewResults: "Sonuçları gör"
      },
      accountMenu: {
        profile: "Profilim",
        myListings: "İlanlarım",
        sellerDashboard: "Satıcı paneli",
        messages: "Mesajlar",
        notifications: "Bildirimler",
        savedSearches: "Kayıtlı aramalar",
        childProfiles: "Çocuğum / ihtiyaçlar",
        favorites: "Favoriler",
        security: "Şifre değiştir",
        logout: "Çıkış yap"
      },
      location: {
        allTurkey: "Tüm Türkiye",
        current: "Seçili konum",
        helper: "Şehir seçimi şimdilik browse URL'sine eklenir; backend eşleşmesi genişletilecek.",
        selectCity: "Şehir seç",
        selected: "{city} seçildi.",
        unsupported: "Tarayıcın konum paylaşımını desteklemiyor.",
        locating: "Konumun alınıyor.",
        locatingButton: "Konum alınıyor...",
        useCurrent: "Konumumu kullan"
      },
      categoryGroups: {
        travel: "Bebek Arabası & Seyahat",
        safety: "Oto Koltuğu & Güvenlik",
        sleep: "Bebek Odası & Uyku",
        feeding: "Beslenme",
        clothing: "Bebek Giyim",
        play: "Oyuncak & Kitap",
        care: "Banyo & Bakım",
        parent: "Anne Ürünleri",
        kids: "3-7 Yaş Çocuk",
        reuse: "Bağış / Takas / Ücretsiz"
      },
      locationOptions: {
        turkiye: "Tüm Türkiye",
        istanbul: "İstanbul",
        ankara: "Ankara",
        izmir: "İzmir",
        bursa: "Bursa",
        antalya: "Antalya",
        konya: "Konya",
        kocaeli: "Kocaeli",
        sakarya: "Sakarya",
        eskisehir: "Eskişehir",
        adana: "Adana"
      },
      categoryLinks: {
        stroller: "Bebek arabası",
        pushchair: "Puset",
        carrycot: "Portbebe",
        babyCarrier: "Kanguru",
        travelSystem: "Seyahat sistemi",
        carSeat: "Oto koltuğu",
        infantSeat: "Ana kucağı",
        safetyGate: "Güvenlik kapısı",
        babyMonitor: "Bebek telsizi",
        crib: "Beşik",
        playpen: "Park yatak",
        sleepSack: "Uyku tulumu",
        nursery: "Bebek odası",
        highChair: "Mama sandalyesi",
        bottle: "Biberon",
        sterilizer: "Sterilizatör",
        breastPump: "Süt pompası",
        zeroToThreeMonths: "0-3 ay",
        oneYearClothes: "1 yaş",
        twoYearCoat: "2 yaş mont",
        babyShoes: "Ayakkabı",
        montessoriToy: "Montessori oyuncak",
        educationalToy: "Eğitici oyuncak",
        childrenBook: "Kitap",
        puzzle: "Puzzle",
        babyBath: "Bebek küveti",
        diaperChanging: "Bez değiştirme",
        careBag: "Bakım çantası",
        maternityWear: "Hamile giyim",
        nursingProducts: "Emzirme ürünleri",
        parentGuides: "Ebeveyn rehberleri",
        threeToSevenToy: "3-7 yaş oyuncak",
        bike: "Bisiklet",
        scooter: "Scooter",
        preschool: "Okul öncesi",
        freeBabyClothes: "Ücretsiz bebek kıyafeti",
        donation: "Bağış",
        swap: "Takas"
      },
      quickCategoryLinks: {
        parentGuide: "Ebeveyn rehberi",
        childNeeds: "Çocuğum",
        assistant: "Asistan",
        parentReviews: "Ebeveyn yorumları"
      },
      popularSearchTerms: [
        "Bebek arabası",
        "Oto koltuğu",
        "Mama sandalyesi",
        "Park yatak",
        "Montessori oyuncak",
        "2 yaş mont",
        "Ücretsiz bebek kıyafeti"
      ]

    },
    publicPages: {
      home: {
        heroEyebrow: "BabyLoop pazarı",
        heroTitle: "Bebek ve çocuk ihtiyaçlarını yakınında bul.",
        heroBody: "Bebek arabası, oto koltuğu, oyuncak, kıyafet, bağış ve takas ürünlerini tek odaklı aile pazarında ara.",
        sellCta: "İlan ver",
        browseCta: "İlanları keşfet",
        marketHeroLabel: "BabyLoop pazar ana alanı",
        marketHeroTitle: "Yakınındaki bebek ve çocuk ürünlerini keşfet",
        marketHeroBody: "Yeni ilanlara göz at veya kullanmadıklarını başka ailelere ulaştır.",
        latestListingsTitle: "Son ilanlar",
        latestListingsLoading: "Son ilanlar yükleniyor",
        latestListingsEmpty: "Henüz yeni ilan yok",
        latestListingsUnavailable: "Son ilanlar şu an yüklenemiyor",
        carouselLabel: "BabyLoop pazar öne çıkanları",
        carouselControls: "Hero banner kontrolleri",
        previousSlide: "Önceki",
        nextSlide: "Sonraki",
        slideLabel: "{index}. slide'ı göster",
        trendsLabel: "Trend aramalar",
        heroSlides: [
          {
            title: "Bebek ihtiyaçlarını daha kolay bul",
            body: "Bebek arabası, oto koltuğu, oyuncak ve daha fazlasını ailelerden keşfet.",
            cta: "İlanları keşfet",
            href: "/browse",
            tone: "discover",
            visualPrimary: "Bebek arabası",
            visualSecondary: "Oto koltuğu",
            visualTertiary: "Oyuncak"
          },
          {
            title: "Kullanmadıklarını kolayca ilana dönüştür",
            body: "Bebek ve çocuk ürünlerini dakikalar içinde listele.",
            cta: "İlan ver",
            href: "/sell",
            tone: "sell",
            visualPrimary: "Temiz fotoğraf",
            visualSecondary: "Hızlı ilan",
            visualTertiary: "Hazır"
          },
          {
            title: "Ücretsiz ve uygun fiyatlı ürünleri kaçırma",
            body: "Bağış, takas ve bütçe dostu ürünleri tek yerde keşfet.",
            cta: "Ücretsiz ürünleri gör",
            href: "/browse?q=%C3%BCcretsiz",
            tone: "reuse",
            visualPrimary: "Ücretsiz kıyafet",
            visualSecondary: "Takas",
            visualTertiary: "Uygun fiyat"
          }
        ],
        popularTitle: "Popüler aramalar",
        categoriesTitle: "İhtiyaca göre keşfet",
        trustTitle: "Daha sakin ikinci el akışı",
        trustBody: "Mesajlaşmayı BabyLoop içinde tut, iletişim bilgilerini gizli bırak ve yalnızca güvensiz durumda bildir."
      },
      browse: {
        title: "Pazar sonuçları",
        subtitle: "Ara, filtrele ve aile ihtiyacına uyan ilanı aç.",
        filters: "Filtreler",
        category: "Kategori",
        search: "Arama",
        type: "Tip",
        condition: "Durum",
        minPrice: "En az fiyat",
        maxPrice: "En çok fiyat",
        imagesOnly: "Sadece görselli",
        sort: "Sıralama",
        sortNewest: "En yeni",
        sortOldest: "En eski",
        sortPriceAsc: "Fiyat artan",
        sortPriceDesc: "Fiyat azalan",
        apply: "Uygula",
        clear: "Temizle",
        allCategories: "Tüm kategoriler",
        allTypes: "Tüm tipler",
        allConditions: "Tüm durumlar",
        activeFilters: "Aktif filtreler",
        resultCount: "{total} ilandan {shown} tanesi gösteriliyor",
        noResultsTitle: "Bu aramaya uygun ilan yok",
        noResultsBody: "Daha geniş bir kelime dene, bir filtreyi kaldır ya da ihtiyacı sonra takip etmek için kaydet.",
        saveSearch: "Aramayı kaydet"
      },
      listingDetail: {
        back: "Sonuçlara dön",
        messageSeller: "Satıcıya mesaj at",
        favorite: "Favorile",
        report: "İlanı bildir",
        seller: "Satıcı",
        details: "İlan bilgileri",
        safety: "Hızlı güvenlik kontrolü",
        safetyBody: "Buluşmadan önce durum, eksik parça, teslim beklentisi ve güvenlik geçmişini netleştir.",
        askAssistant: "Neye bakmalıyım?",
        related: "Benzer ilanlar"
      },
      messaging: {
        inboxTitle: "Mesajlar",
        inboxBody: "Okunmamış konuşmaları aç ve ürün sorularını BabyLoop içinde tut.",
        threadTitle: "Konuşma",
        safetyMenu: "Güvenlik işlemleri",
        reportUser: "Kullanıcıyı bildir",
        blockUser: "Kullanıcıyı engelle",
        reportMessage: "Mesajı bildir",
        context: "İlan bağlamı",
        composerTitle: "Mesaj",
        composerHint: "Durum, eksik parça, ek fotoğraf veya teslim zamanı sor."
      },
      account: {
        hubTitle: "Hesabım",
        hubBody: "Pazar kısayollarını, satıcı araçlarını, aile planlamasını ve güvenliği yönet.",
        profileSummary: "Profil özeti",
        marketplaceShortcuts: "Pazar kısayolları",
        sellerTools: "Satıcı araçları",
        familyPlanning: "Aile ihtiyaçları",
        security: "Güvenlik",
        preferences: "Tercihler",
        payments: "Ödeme araçları",
        notificationPreferences: "Bildirim tercihleri",
        comingSoon: "Yakında"
      },
      support: {
        compactBoundary: "Yalnızca pazar rehberliği. BabyLoop profesyonel tıbbi, güvenlik veya hukuki tavsiye yerine geçmez.",
        guidesTitle: "Ebeveyn rehberleri",
        assistantTitle: "BabyLoop Asistan"
      }
    },
    nav: {
      tagline: "Ebeveyn pazarı",
      searchLabel: "Ara",
      searchHint: "Bebek arabası, oto koltuğu, oyuncak...",
      searchPlaceholder: "İlanlarda ara",
      searchHelp: "En az 3 karakter yaz",
      searchLoading: "İlanlar aranıyor...",
      searchEmpty: "Eşleşen ilan bulunamadı.",
      searchViewAll: "Sonuçları görüntüle",
      home: "Ana sayfa",
      marketplace: "Pazar",
      sell: "Sat / paylaş",
      account: "Hesap",
      browseListings: "İlanları keşfet",
      browseDescription: "Ailelerin paylaştığı ihtiyaçları bul",
      favorites: "Favoriler",
      favoritesDescription: "Kaydettiğin ilanlara geri dön",
      messages: "Mesajlar",
      messagesDescription: "Alıcı ve satıcılarla konuş",
      notifications: "Bildirimler",
      notificationsDescription: "Mesaj ve pazar güncellemelerini gör",
      notificationsWithCount: "Bildirimler ({count})",
      myListings: "İlanlarım",
      myListingsDescription: "İlanlarını ve hareketlerini görüntüle",
      verifyEmail: "E-postayı doğrula",
      changePassword: "Şifre değiştir",
      mobileMenu: "Menü"
    },
    home: {
      eyebrow: "Bebek ve çocuk ihtiyaçları",
      title: "Bebek ihtiyaçları, ebeveyn rehberliği ve güvenli ikinci el keşfi için güçlü bir döngü.",
      subtitle:
        "BabyLoop; ilanları, satıcı araçlarını, çocuk yaş bandı planlamasını, ebeveyn rehberlerini ve asistan destekli alışveriş kontrollerini tek bir güvenli pazar akışında birleştirir.",
      heroPrimaryLoggedOut: "Hesap oluştur",
      heroSecondaryLoggedOut: "Giriş yap",
      heroThird: "Pazarı keşfet",
      heroPrimaryLoggedIn: "Pazarı keşfet",
      heroSecondaryLoggedIn: "İlan oluştur",
      heroThirdLoggedIn: "İlanlarım",
      previewStatus: "Canlı pazar",
      previewTitle: "Temiz bebek arabası",
      previewDescription: "İyi durumda, ebeveyninden, yerel teslim için hazır.",
      previewPrice: "3.250 TL",
      previewCategory: "Bebek arabaları",
      previewTrust: "Doğrulanmış ebeveyn hesabı",
      howEyebrow: "Nasıl çalışır",
      howTitle: "Günlük aile ihtiyaçları için uçtan uca bir döngü.",
      howDescription:
        "BabyLoop keşif, ilan oluşturma, favoriler, kayıtlı aramalar, mesajlaşma ve güvenlik aksiyonlarını ebeveyn yolculuğu boyunca birbirine bağlar.",
      steps: [
        {
          title: "İhtiyacını bul",
          body: "Bebek ekipmanları, oyuncaklar, kıyafetler ve oda ürünlerini kategori, durum, fiyat, fotoğraf ve statü bilgisiyle keşfet."
        },
        {
          title: "Net ilan oluştur",
          body: "Durum, fiyat, kategori, fotoğraf ve gerektiğinde AI destekli hazırlıkla daha anlaşılır ilan oluştur."
        },
        {
          title: "Önce konuş",
          body: "Mesajlaşma, alıcı kontrolleri, raporlama ve engelleme ile sonraki adımları daha güvenli bir pazar akışı içinde netleştir."
        }
      ],
      categoriesEyebrow: "Pazar akışları",
      categoriesTitle: "Ebeveyn kararlarına, yaş dönemi ihtiyaçlarına ve güvenilir yeniden kullanıma uygun düzen.",
      categoriesDescription:
        "BabyLoop keşfi satış, bağış ve takasa uygun ihtiyaçlar etrafında düzenler; rehberleri, kayıtlı aramaları, çocuk profillerini ve asistan yönlendirmelerini aynı yolculuğa bağlar.",
      categoryCards: [
        {
          title: "Bebek ekipmanları",
          body: "Bebek arabası, oto koltuğu, taşıyıcı ve oda ürünleri gibi hızlı büyüme döneminde el değiştiren ihtiyaçlar."
        },
        {
          title: "Oyuncak ve kitap",
          body: "Durumu ve açıklaması net, günlük öğrenme ve oyun ürünleri."
        },
        {
          title: "Kıyafet ve paketler",
          body: "Mevsimlik ürünleri ebeveynlerin hızlı tarayabileceği şekilde gruplama."
        }
      ],
      safetyEyebrow: "Güven ve düzen",
      safetyTitle: "Ebeveynler için daha sakin bir pazar deneyimi.",
      safetyDescription:
        "BabyLoop sahipliği, hesap durumunu, favorileri, mesajları, raporları, engellemeleri, moderasyon vakalarını ve denetlenebilir admin aksiyonlarını gizlilik odaklı profillerle ilişkilendirir.",
      safetyItems: [
        "Ebeveyn hesapları ve giriş gerektiren yazma işlemleri",
        "Durum, ilan tipi, satıcı ve konumu ayıran gizlilik odaklı ilan bilgileri",
        "Katılımcı mesajlaşması, raporlama, engelleme, moderasyon ve audit destekli inceleme"
      ],
      finalTitle: "Bebek eşyalarına yeni bir döngü vermeye hazır mısın?",
      finalDescription: "Güvenli ilanları keşfet, aile ihtiyaçlarını planla, asistana sor ya da bir sonraki ebeveyn için net bir ilan oluştur."
    },
    auth: {
      loginTitle: "Tekrar hoş geldin",
      loginDescription: "İlan kaydetmek, satıcılarla konuşmak ve ürünlerini yönetmek için giriş yap.",
      registerTitle: "BabyLoop hesabını oluştur",
      registerDescription: "Aile ihtiyaçları için daha sakin ve ebeveyn dostu bir pazara katıl.",
      forgotTitle: "Şifreni sıfırla",
      forgotDescription: "BabyLoop hesabın için güvenli bir şifre sıfırlama isteği hazırla.",
      resetTitle: "Yeni şifre belirle",
      resetDescription: "Hesabını güvene almak için sıfırlama bağlantını kullan.",
      verifyTitle: "E-postanı doğrula",
      verifyDescription: "BabyLoop hesabına bağlı e-posta adresini doğrula.",
      requestVerifyTitle: "E-postanı doğrula",
      requestVerifyDescription: "Hesap e-postana yeni bir doğrulama bağlantısı gönder.",
      callbackTitle: "Giriş tamamlanıyor",
      callbackDescription: "BabyLoop oturumun güvenli şekilde tamamlanıyor.",
      changePasswordTitle: "Şifre değiştir",
      changePasswordDescription: "E-posta ile giriş için kullandığın şifreyi güncelle.",
      continueGoogle: "Google ile devam et",
      openingGoogle: "Google açılıyor...",
      googleUnavailable: "Bu ortamda Google ile giriş yapılandırılmamış.",
      divider: "veya",
      noAccount: "Hesabın yok mu?",
      createOne: "Hesap oluştur",
      alreadyRegistered: "Zaten hesabın var mı?",
      forgotPassword: "Şifreni mi unuttun?",
      requestReset: "Sıfırlama iste",
      submitLogin: "Giriş yap",
      submitRegister: "Hesap oluştur",
      submitting: "Gönderiliyor...",
      accountFailed: "Hesap işlemi başarısız",
      requiredFields: "Lütfen gerekli alanları doldur.",
      registerNote: "Profilin hesabınla birlikte oluşturulur.",
      loginNote: "Devam etmek için e-posta ve şifreni kullan.",
      registrationSuccess: "Kayıt başarılı",
      emailDevLink:
        "E-posta gönderimi henüz bağlı değil. Hesabı doğrulamak için bu yerel geliştirme bağlantısını kullan.",
      verifyLocally: "E-postayı yerelde doğrula",
      emailWillBeRequired:
        "Kayıt başarılı. E-posta gönderimi yapılandırıldığında doğrulama gerekecek.",
      verificationRequestGeneric:
        "Bu e-posta doğrulama gerektiren bir hesaba aitse doğrulama e-postası hazırlanır.",
      emailVerificationDevTitle: "Yerel e-posta doğrulama bağlantısı",
      resetPrepared: "İstek hazırlandı",
      resetGeneric:
        "Bu e-posta için bir hesap varsa şifre sıfırlama hazırlığı yapılmıştır.",
      resetDevTitle: "Yerel sıfırlama kodu",
      resetDevBody: "E-posta gönderimi henüz bağlı değil. Sıfırlama formunu test etmek için bu yerel kodu kullan.",
      resetSecurityNote: "Sıfırlama kodları tek kullanımlıktır ve kısa süre sonra geçerliliğini yitirir.",
      resetNoReveal: "Bu yanıt hesabın var olup olmadığını göstermez.",
      preparing: "Hazırlanıyor...",
      requestResetButton: "Sıfırlama iste",
      loginBeforePasswordChange: "Şifrenizi değiştirmeden önce giriş yapmalısınız.",
      currentPasswordRequired: "Mevcut şifrenizi girin.",
      currentPassword: "Mevcut şifre",
      passwordChangeFailed: "Şifre değiştirilemedi",
      passwordChangeNote: "Şifrenizi değiştirdiğinizde hesabınızdaki diğer aktif oturumlar kapatılır.",
      newPassword: "Yeni şifre",
      confirmNewPassword: "Yeni şifre tekrar",
      tokenMissing: "Sıfırlama kodu eksik",
      tokenMissingBody: "Hesabın için oluşturulan sıfırlama bağlantısını aç ya da yeni bir sıfırlama iste.",
      passwordsDoNotMatch: "Şifreler eşleşmiyor.",
      passwordTooShort: "Yeni şifre en az 8 karakter olmalı.",
      changePassword: "Şifreyi değiştir",
      changing: "Değiştiriliyor...",
      passwordReset: "Şifre sıfırlandı",
      passwordResetBody: "Şifren değiştirildi. Yeni şifrenle giriş yapabilirsin.",
      passwordChangedTitle: "Şifre değiştirildi",
      passwordChangedBody: "Şifren değiştirildi. Lütfen yeni şifrenle tekrar giriş yap.",
      googleFailedTitle: "Google girişi başarısız",
      googleFailedBody: "Google ile kimlik doğrulama tamamlanamadı. Lütfen tekrar dene ya da e-posta ve şifre kullan.",
      googleUnavailableTitle: "Google girişi kullanılamıyor",
      googleUnavailableBody: "Bu ortamda Google ile giriş yapılandırılmamış. Lütfen e-posta ve şifre kullan.",
      verificationMissing: "Doğrulama kodu eksik",
      verificationMissingBody: "Hesabın için oluşturulan doğrulama bağlantısını aç.",
      requestVerification: "Doğrulama bağlantısını gönder",
      verificationRequestSent: "Doğrulama e-postası istendi",
      verificationLinkSafetyNote: "Bağlantı kısa süre geçerlidir. Sana ait olmayan bir doğrulama isteğini kullanma veya başkalarıyla paylaşma.",
      verifyingEmail: "E-posta doğrulanıyor",
      verifyingEmailBody: "BabyLoop doğrulama kodunu kontrol ediyor.",
      emailVerified: "E-posta doğrulandı",
      emailVerifiedBody: "E-posta başarıyla doğrulandı.",
      verificationFailed: "Doğrulama başarısız",
      verificationFailedBody: "Doğrulama bağlantısı geçersiz ya da süresi dolmuş.",
      requestNewVerification: "Yeni doğrulama bağlantısı iste",
      authModalTabsLabel: "Giriş seçimi",
      authModalEyebrow: "BABYLOOP",
      fullName: "Ad soyad",
      locationPlaceholder: "İstanbul",
      changePasswordEyebrow: "Şifre",
      changePasswordFormTitle: "Şifreni güncelle",
      changePasswordFormDescription: "Şifre değişince tekrar giriş yapman gerekir.",
      passwordSessionRenewedTitle: "Oturum yenilenir",
      passwordSafeUseTitle: "Güvenli kullanım",
      passwordSafeUseBody: "Şifreni mesajlarda, ilanlarda veya asistan sorularında paylaşma.",
      forgotFormEyebrow: "Hesap kurtarma",
      forgotFormTitle: "Şifre sıfırlamayı güvenle iste",
      forgotFormDescription: "Hesap e-postanı gir. BabyLoop hesabın var olup olmadığını açığa çıkarmamak için tarafsız yanıt verir.",
      recoveryLinksTitle: "Bağlantıları paylaşma",
      recoveryLinksBody: "Kurtarma bağlantıları ve yerel geliştirme kodları yalnızca hesap sahibi tarafından kullanılmalı.",
      afterResetTitle: "Sıfırlamadan sonra",
      afterResetBody: "Tekrar giriş yap ve ortak cihazlarda pazar mesajları veya satıcı araçlarını kullanmaktan kaçın.",
      resetFormEyebrow: "Yeni şifre",
      resetFormTitle: "Benzersiz bir şifre seç",
      resetFormDescription: "Başka sitelerde kullanmadığın bir şifre seç. Kurtarma kodlarını veya kimlik bilgilerini BabyLoop mesajlarına, ilanlarına ya da asistan sorularına yapıştırma.",
      resetNextStepTitle: "Sonraki adım",
      resetNextStepBody: "Yeni şifrenle giriş yap ve eski şifreyi başka yerde tekrar kullanmadığından emin ol.",
      singleUseTokenTitle: "Tek kullanımlık kod",
      resetAfterSubmitBody: "Giriş sayfasına dön ve özel hesap sayfalarının doğru açıldığını kontrol et.",
      requestVerificationEyebrow: "E-posta doğrulama",
      requestVerificationTitle: "Yeni doğrulama bağlantısı iste",
      requestVerificationDescription: "Bağlantıyı gönderdikten sonra gelen kutunu ve spam klasörünü kontrol et.",
      verificationInProgressTitle: "Doğrulama sürüyor",
      verificationInProgressBody: "BabyLoop hesaba özel güven sinyallerini açmadan önce doğrulama kodunu kontrol ediyor.",
      verifiedTitle: "Doğrulandı",
      verifiedBody: "Giriş sayfasına dönüp özel BabyLoop hesap özelliklerini kullanmaya devam edebilirsin.",
      expiredVerificationTitle: "Süresi dolmuş veya geçersiz bağlantı",
      expiredVerificationBody: "Eski ya da iletilmiş bağlantıları tekrar kullanmak yerine BabyLoop'tan yeni doğrulama bağlantısı iste."
    },
    authSurfaceGuide: {
      login: {
        ariaLabel: "Giriş rehberi",
        eyebrow: "Güvenli erişim",
        title: "Korunan BabyLoop hesabınla devam et",
        description:
          "İlanlarını, mesajlarını, favorilerini, kayıtlı aramalarını, çocuk yaş bandı ihtiyaçlarını ve asistan rehberliğini hesabınla yönet.",
        badge: "Cookie oturumu",
        steps: [
          "Erişim, kalıcı tarayıcı depolaması yerine cookie destekli oturumlarla yönetilir.",
          "Giriş yaptıktan sonra pazar ve hesap araçlarına menüden ulaşabilirsin.",
          "Özel iletişim bilgilerini ilan metinlerinde, mesajlarda ve asistan sorularında paylaşma."
        ],
        actions: [
          { href: "/browse", label: "Keşfet" },
          { href: "/assistant", label: "Asistana sor" },
          { href: "/register", label: "Hesap oluştur" }
        ]
      },
      register: {
        ariaLabel: "Hesap oluşturma rehberi",
        eyebrow: "Hesap oluştur",
        title: "Gizlilik odaklı pazar araçlarıyla başla",
        description:
          "Ürün satmak, güvenli mesajlaşmak, filtre kaydetmek ve yaş bandına göre pazar önerileri almak için hesap oluştur.",
        badge: "Gizlilik öncelikli",
        steps: [
          "BabyLoop yaşam döngüsü önerileri için çocuğun tam doğum tarihini istemez.",
          "Satıcı ve alıcı yüzeyleri gereksiz kimlik görünürlüğünü azaltacak şekilde ayrılır.",
          "Profil ve ilan bilgilerini net tut, özel iletişim bilgisi ekleme."
        ],
        actions: [
          { href: "/browse", label: "Önce keşfet" },
          { href: "/guides", label: "Rehberleri oku" },
          { href: "/login", label: "Hesabım var" }
        ]
      },
      forgot_password: {
        ariaLabel: "Hesap kurtarma rehberi",
        eyebrow: "Hesap kurtarma",
        title: "Erişimini güvenli şekilde kurtar",
        description:
          "Hesabına erişemediğinde kurtarma akışını kullan. Sonrasında hesap ayarlarını gözden geçir ve ortak cihaz oturumlarından kaçın.",
        badge: "Kurtarma",
        steps: [
          "Yalnızca resmi BabyLoop kurtarma sayfasını kullan.",
          "Kimlik bilgilerini değiştirdikten sonra ortak cihazlarda çıkış yap.",
          "Kurtarma bağlantılarını veya kodlarını başka biriyle paylaşma."
        ],
        actions: [
          { href: "/login", label: "Girişe dön" },
          { href: "/guides", label: "Ebeveyn rehberleri" }
        ]
      },
      reset_password: {
        ariaLabel: "Şifre sıfırlama rehberi",
        eyebrow: "Yeni şifre belirle",
        title: "Devam etmeden önce daha güçlü bir şifre seç",
        description:
          "Sıfırlama sonrasında BabyLoop korumalı oturum yönetimini ve hesap düzeyi güvenlik kontrollerini kullanmaya devam eder.",
        badge: "Şifre",
        steps: [
          "Başka yerde kullanmadığın benzersiz bir şifre seç.",
          "Kimlik bilgilerini ekran görüntülerinde, notlarda veya mesajlarda saklama.",
          "Sıfırlamayı onayladıktan sonra pazar araçlarına dönebilirsin."
        ],
        actions: [
          { href: "/login", label: "Giriş yap" },
          { href: "/browse", label: "Keşfet" }
        ]
      },
      verify: {
        ariaLabel: "Doğrulama rehberi",
        eyebrow: "Doğrulama",
        title: "Hesap doğrulamasını tamamla",
        description:
          "Doğrulama, hesap işlemlerini daha anlaşılır tutar ve pazar etkileşimlerini korumaya yardımcı olur.",
        badge: "Doğrula",
        steps: [
          "Hesaba özel özelliklere güvenmeden önce doğrulamayı tamamla.",
          "Ürün soruları ve teslim beklentileri için mesajları kullan.",
          "Şüpheli veya yanıltıcı pazar davranışlarını bildir."
        ],
        actions: [
          { href: "/login", label: "Giriş yap" },
          { href: "/guides", label: "Rehberler" }
        ]
      },
      change_password: {
        ariaLabel: "Şifre değiştirme rehberi",
        eyebrow: "Hesap güvenliği",
        title: "Şifreni bilinçli şekilde güncelle",
        description:
          "Kimlik bilgilerini yenilemek veya ortak cihaz kullandıktan sonra hesabını güvene almak istediğinde bu sayfayı kullan.",
        badge: "Güvenlik",
        steps: [
          "Benzersiz bir şifre kullan ve pazar mesajlarından ayrı tut.",
          "Şifreyi değiştirdikten sonra giriş ve çıkış akışlarının doğru çalıştığını kontrol et.",
          "Hesap kötüye kullanımından şüpheleniyorsan mesajlarını ve ilanlarını gözden geçir."
        ],
        actions: [
          { href: "/account/seller", label: "Satıcı paneli" },
          { href: "/my-listings", label: "İlanlarım" },
          { href: "/notifications", label: "Bildirimler" }
        ]
      }
    },
    accountSurfaceGuide: {
      my_listings: {
        eyebrow: "İlan yönetimi",
        title: "Her ilanı net ve aksiyon alınabilir tut",
        description:
          "Durumu gözden geçir, kondisyonu güncelle, herkese açık sayfayı aç ve rezerve etme, satıldı işaretleme veya yenileme kararından önce satıcı içgörülerini kullan.",
        badge: "Satıcı akışı",
        steps: [
          "Başlık, fotoğraf, kondisyon, fiyat ve dahil aksesuarları kontrol et.",
          "Arşivle, geri al, rezerve et ve satıldı aksiyonlarını bilinçli kullan.",
          "Büyük düzenlemelerden sonra alıcı görünümünü doğrulamak için herkese açık ilanı aç."
        ],
        actions: [
          { href: "/sell", label: "İlan oluştur" },
          { href: "/account/seller", label: "Satıcı paneli" },
          { href: "/guides", label: "Ebeveyn rehberleri" }
        ]
      },
      favorites: {
        eyebrow: "Favoriler",
        title: "Kaydettiğin ürünleri daha iyi kararlara dönüştür",
        description:
          "Favoriler kısa listedir. Mesaj atmadan önce kondisyonu, fotoğrafları, satıcı cevaplarını ve ilgili rehber konularını karşılaştır.",
        badge: "Alıcı akışı",
        steps: [
          "Mevcut yaş bandı veya sezon ihtiyacına uyan favorileri tekrar kontrol et.",
          "Satılmış veya artık ilgisiz ilanları listeden çıkar.",
          "Teslimata karar vermeden önce ilan detayında sorularını netleştir."
        ],
        actions: [
          { href: "/browse", label: "Daha fazla keşfet" },
          { href: "/guides", label: "Alış rehberleri" },
          { href: "/assistant", label: "Asistana sor" }
        ]
      },
      saved_searches: {
        eyebrow: "Kayıtlı aramalar",
        title: "Tekrarlayan ihtiyaçlar için filtreleri yeniden kullan",
        description:
          "Kayıtlı aramalar; beden, sezon, fiyat ve kategori ihtiyaçlarını her seferinde baştan kurmadan takip etmeye yardımcı olur.",
        badge: "Takip",
        steps: [
          "Tek büyük genel arama yerine her ihtiyaç için ayrı kayıtlı arama oluştur.",
          "Yakından incelenmesi gereken ürünlerde fiyat ve görsel filtrelerini kullan.",
          "Bildirim gönderimi bilerek ayrı tutulur ve daha sonra eklenebilir."
        ],
        actions: [
          { href: "/browse", label: "Keşiften oluştur" },
          { href: "/account/children", label: "Yaş bandı ihtiyaçları" },
          { href: "/assistant", label: "Asistana sor" }
        ]
      },
      notifications: {
        eyebrow: "Bildirimler",
        title: "Pazar güncellemelerini tek yerden incele",
        description:
          "Mesajları, ilan etkileşimlerini ve hesap güncellemelerini alıcı kimliklerini gereksiz görünür kılmadan takip etmek için bildirimleri kullan.",
        badge: "Gelen kutusu",
        steps: [
          "Önce okunmamış öğeleri aç ve inceledikten sonra kuyruğu temizle.",
          "Mesajla ilgili bildirimlerde konuşma güvenliği rehberliğini kullan.",
          "Favori ve ilan aktiviteleri varsayılan olarak gizlilik güvenli kalır."
        ],
        actions: [
          { href: "/conversations", label: "Mesajlar" },
          { href: "/notifications", label: "Bildirimler" },
          { href: "/account/notification-preferences", label: "Tercihler" }
        ]
      },
      seller_dashboard: {
        eyebrow: "Satıcı paneli",
        title: "Alıcıları göstermeden toplam içgörüyü kullan",
        description:
          "Satıcı paneli yalnızca performans sinyallerini gösterir. Alıcı kimliği, özel iletişim bilgileri ve mesaj metni burada görünmemelidir.",
        badge: "Gizlilik güvenli",
        steps: [
          "Favorileri, görüntülenmeleri, ilan tıklamalarını ve iletişim niyetlerini birlikte izle.",
          "Fotoğrafı zayıf, kondisyonu belirsiz veya iletişim niyeti düşük ilanları iyileştir.",
          "AI taslak ve fiyat rehberliğini otomatik yayın akışı değil, başlangıç noktası olarak kullan."
        ],
        actions: [
          { href: "/sell", label: "İlan oluştur" },
          { href: "/my-listings", label: "İlanları yönet" },
          { href: "/assistant", label: "Asistana sor" }
        ]
      }
    },
    mobileNavigation: {
      drawerLabel: "BabyLoop mobil navigasyon",
      brandHomeLabel: "BabyLoop ana sayfa",
      quickLinksLabel: "Mobil pazar bağlantıları",
      sellAuthTitle: "İlan oluşturmak için giriş yap"
    },
    authPageShell: {
      assuranceLabel: "Kimlik doğrulama güvenlik özeti",
      assuranceTitle: "Daha güvenli pazar erişimi için tasarlandı",
      assuranceBody: "BabyLoop hesap işlemlerini herkese açık keşiften ayırır ve özel kurtarma durumunu gereksiz yere açığa çıkarmaz.",
      checklistLabel: "Hesap güvenliği kontrol listesi",
      checklistEyebrow: "Güvenlik kontrolü",
      checklistTitle: "Devam etmeden önce",
      callback: {
        badge: "Oturum",
        eyebrow: "Kimlik doğrulama",
        checks: [
          "Sağlayıcı dönüşünü tamamlar",
          "Korumalı oturumu yeniler",
          "Yalnızca oturum doğrulandıktan sonra yönlendirir"
        ]
      },
      forgot: {
        badge: "Kurtarma",
        eyebrow: "Hesap kurtarma",
        checks: [
          "Hesabın var olup olmadığını göstermez",
          "Resmi BabyLoop kurtarma akışını kullanır",
          "Kurtarma bağlantıları ve kodları gizli kalmalı"
        ]
      },
      login: {
        badge: "Güvenli erişim",
        eyebrow: "Hesaba giriş",
        checks: [
          "Cookie tabanlı oturum yönetimi kullanılır",
          "Access token kalıcı tarayıcı depolamasında tutulmaz",
          "Korumalı işlemler kimlik doğrulamalı istek kullanır"
        ]
      },
      password: {
        badge: "Güvenlik",
        eyebrow: "Hesap güvenliği",
        checks: [
          "Mevcut şifre gerekir",
          "Değişiklikten sonra aktif refresh oturumları kapanır",
          "Kimlik bilgileri mesaj ve ilanlardan uzak tutulur"
        ]
      },
      register: {
        badge: "Gizlilik odaklı profil",
        eyebrow: "Hesap oluşturma",
        checks: [
          "Pazar profili oluşturur",
          "E-posta doğrulaması ayrı tamamlanabilir",
          "Çocuk planlaması tam doğum tarihi yerine yaş bandı kullanır"
        ]
      },
      requestVerify: {
        badge: "Doğrulama",
        eyebrow: "E-posta doğrulama",
        checks: [
          "Resmi doğrulama isteği kullanılır",
          "Hesap varlığını gereksiz yere açığa çıkarmaz",
          "Doğrulama bağlantıları paylaşılmamalı"
        ]
      },
      reset: {
        badge: "Yeni şifre",
        eyebrow: "Şifre sıfırlama",
        checks: [
          "Sıfırlama kodu tek kullanımlıktır",
          "Yeni şifre benzersiz olmalı",
          "Tamamlandıktan sonra giriş sayfasına dönülür"
        ]
      },
      verify: {
        badge: "Doğrula",
        eyebrow: "E-posta doğrulama",
        checks: [
          "Doğrulama kodunu kontrol eder",
          "Hesap onayını tamamlar",
          "Süresi dolduysa yeni bağlantı ister"
        ]
      }
    },
    accountProfile: {
      ariaLabel: "Hesabım",
      pageTitle: "Hesabım",
      pageDescription: "Pazar kısayollarını, satıcı araçlarını ve güvenlik ayarlarını tek yerden yönet.",
      sectionsLabel: "Hesap bölümleri",
      loadingTitle: "Hesap bilgileri yükleniyor",
      loadFailedTitle: "Hesap bilgileri alınamadı",
      sectionFastAccessDescription: "Sık kullandığın alanlara hızlıca geç.",
      comingSoon: "Yakında",
      comingSoonAria: "{label} yakında",
      profileSummaryDescription: "Hesabında görünen temel bilgileri burada görebilirsin.",
      name: "Ad soyad",
      city: "Şehir",
      securityAndPassword: "Güvenlik merkezi",
      securityDescription: "Şifreni, e-posta OTP / MFA ayarını ve aktif cihaz oturumlarını yönet.",
      securityPasswordDescription: "Şifreni güncelle ve hesabını güvende tut.",
      otpDescription: "Girişlerde ikinci doğrulama adımı.",
      mobileApprovalDescription: "Yeni girişleri mobil onayla doğrulama.",
      trustedDevicesDescription: "Güvendiğin cihazları daha sonra burada görebileceksin.",
      preferencesDescription: "Bildirim ve ödeme ayarları hazır olduğunda buradan açılacak.",
      notificationPreferencesDescription: "Çocuk profili, kayıtlı arama ve pazar bildirimlerini yönet.",
      paymentTools: "Ödeme araçları",
      paymentToolsDescription: "Ödeme araçları henüz BabyLoop içinde aktif değil.",
      menuItems: {
        profile: {
          label: "Profil özeti",
          description: "Ad, şehir ve hesap güvenliği"
        },
        marketplace: {
          label: "Pazar kısayolları",
          description: "Favoriler, mesajlar ve bildirimler"
        },
        seller: {
          label: "Satıcı araçları",
          description: "İlan verme ve satış alanı"
        },
        family: {
          label: "Aile ihtiyaçları",
          description: "Çocuğum, rehberler ve asistan"
        },
        security: {
          label: "Güvenlik",
          description: "Şifre ve yakında gelecek korumalar"
        },
        preferences: {
          label: "Tercihler",
          description: "Bildirim ve ödeme ayarları"
        },
        deletion: {
          label: "Hesabı sil",
          description: "BabyLoop hesabını kalıcı olarak kapat"
        }
      },
      links: {
        favorites: {
          label: "Favoriler",
          description: "Kaydettiğin ilanlara hızlıca dön."
        },
        savedSearches: {
          label: "Kayıtlı aramalar",
          description: "Takip ettiğin arama ve filtreleri yönet."
        },
        messages: {
          label: "Mesajlar",
          description: "Alıcı ve satıcı konuşmalarını aç."
        },
        notifications: {
          label: "Bildirimler",
          description: "Mesaj ve ilan hareketlerini gör."
        },
        sell: {
          label: "İlan ver",
          description: "Yeni bir bebek veya çocuk ürünü listele."
        },
        myListings: {
          label: "İlanlarım",
          description: "Yayındaki ve arşivdeki ilanlarını yönet."
        },
        sellerDashboard: {
          label: "Satıcı paneli",
          description: "Satıcı akışını ve ilan durumlarını takip et."
        },
        children: {
          label: "Çocuğum / ihtiyaçlar",
          description: "Çocuğuna ait temel bilgileri sade şekilde tut."
        },
        guides: {
          label: "Ebeveyn rehberleri",
          description: "Kısa ve sakin ebeveyn yanıtlarını keşfet."
        },
        assistant: {
          label: "Asistan",
          description: "BabyLoop Asistan’a kısa bir soru sor."
        }
      }
    },
    notificationsArchive: {
      pageTitle: "Bildirimler",
      pageDescription: "Mesaj ve ilan hareketlerini burada görebilirsin.",
      loadingTitle: "Bildirimler yükleniyor",
      loadingMessage: "Mesaj ve ilan hareketleri hazırlanıyor.",
      unavailableTitle: "Bildirimler yüklenemedi",
      actionFailedTitle: "İşlem tamamlanamadı",
      unreadMessage: "Okunmamış mesaj",
      goToMessages: "Mesajlara git",
      favoriteActivity: "Favori hareketi",
      favoriteSummary: "{count} kullanıcı ürünlerini favori ürünlere ekledi",
      favoriteMovementsLabel: "Favori hareketleri",
      favoritesTitle: "Favoriler",
      favoriteStat: "{total} favori · Bugün +{today}",
      noFavoriteActivity: "Henüz favori hareketi yok.",
      recentLabel: "Son bildirimler",
      recentTitle: "Son hareketler",
      noNotificationsTitle: "Henüz bildirim yok",
      noNotificationsBody: "Mesaj veya ilan hareketi olduğunda burada görünür.",
      unread: "Okunmadı",
      open: "Aç"
    },
    savedSearches: {
      ariaLabel: "Kayıtlı aramalar",
      filtersLabel: "Kayıtlı arama filtreleri",
      title: "Kayıtlı aramalar",
      description: "Kaydettiğin aramaları buradan yönet.",
      actionFailedTitle: "İşlem tamamlanamadı",
      loadingTitle: "Kayıtlı aramalar yükleniyor",
      loadingMessage: "Kaydettiğin filtreler hazırlanıyor.",
      emptyTitle: "Henüz kayıtlı arama yok",
      emptyMessage: "Browse sayfasından bir aramayı kaydedip burada tekrar açabilirsin.",
      emptyFilterTitle: "Bu filtrede arama yok",
      emptyFilterMessage: "Başka bir filtre seçebilir veya ilanları keşfedebilirsin.",
      browseAction: "İlanları keşfet",
      noFilters: "Filtre yok",
      allListings: "Tüm ilanlar",
      notificationsOn: "Bildirim açık",
      notificationsOff: "Bildirim kapalı",
      openSearch: "Aramayı aç",
      updating: "Güncelleniyor...",
      deleting: "Siliniyor...",
      delete: "Sil",
      turnNotificationsOn: "Bildirimleri aç",
      turnNotificationsOff: "Bildirimleri kapat",
      selectedCategory: "Kategori seçili",
      imageOnly: "Sadece görselli",
      filters: {
        all: "Tüm kayıtlı aramalar",
        notifications_on: "Bildirim açık",
        notifications_off: "Bildirim kapalı"
      },
      chips: {
        query: "Arama: {value}",
        type: "Tip: {value}",
        condition: "Durum: {value}",
        minPrice: "En az: {value}",
        maxPrice: "En çok: {value}",
        sort: "Sıralama: {value}"
      }
    },
    footer: {
      description: "Bebek ve çocuk ihtiyaçlarına aileler arasında yeni bir kullanım döngüsü veren ebeveyn dostu pazar.",
      marketplace: "Pazar",
      account: "Hesap",
      support: "Destek",
      browse: "İlanları keşfet",
      sell: "İlan oluştur",
      favorites: "Favoriler",
      messages: "Mesajlar",
      login: "Giriş yap",
      register: "Hesap oluştur",
      verifyEmail: "E-posta doğrula",
      resetPassword: "Şifre sıfırla"
    },
    listings: {
      categoryNames: {
        "car-seats": "Oto Koltukları",
        "montessori-toys": "Montessori Oyuncakları",
        strollers: "Bebek Arabaları",
        toys: "Oyuncaklar"
      },
      listingTypes: {
        sale: "Satılık",
        swap: "Takas",
        donation: "Bağış"
      },
      conditions: {
        new: "Yeni",
        like_new: "Yeni gibi",
        good: "İyi",
        fair: "Orta",
        needs_repair: "Tamir gerekli"
      },
      statuses: {
        active: "Aktif",
        draft: "Taslak",
        reserved: "Ayrıldı",
        sold: "Satıldı",
        archived: "Arşivlendi"
      },
      sellEyebrow: "BabyLoop'ta sat",
      sellTitle: "Güvenilir bir BabyLoop ilanı oluştur",
      sellDescription:
        "Ebeveynlerin mesaj atmadan önce güvenle karar verebilmesi için durum notları, fotoğraflar, teslim bilgisi, dahil parçalar ve fiyat detaylarını hazırla.",
      createAriaLabel: "İlan oluşturma formu",
      listingsUnavailable: "İlanlar kullanılamıyor",
      category: "Kategori",
      noCategoriesAvailable: "Kategori bulunamadı",
      listingType: "İlan tipi",
      title: "Başlık",
      titlePlaceholder: "İyi durumda Stokke bebek arabası",
      description: "Açıklama",
      descriptionPlaceholder: "Durum notlarını, dahil parçaları ve teslim detaylarını ekle.",
      priceAmount: "Fiyat tutarı",
      currency: "Para birimi",
      condition: "Durum",
      images: "Görseller",
      uploadImage: "Görsel yükle",
      imageLimitHelp: "En fazla 5 görsel yükleyebilirsin.",
      unsupportedImageType: "Bu dosya türü desteklenmiyor.",
      imageTooLarge: "Görsel çok büyük.",
      tooManyImages: "Bu ilanda en fazla görsel sayısına ulaşıldı.",
      deleteImage: "Görsel sil",
      uploading: "Yükleniyor...",
      imageUploadFailed: "Görsel yükleme başarısız.",
      imageAuthenticityRejected: "Bu görsel ilan için uygun görünmüyor. Lütfen ürünün gerçek, net ve doğrudan çekilmiş bir fotoğrafını yükle.",
      imageAuthenticityUnavailable: "Görsel güvenlik kontrolü şu anda tamamlanamadı. Lütfen birkaç dakika sonra tekrar dene.",
      imageNeedsReviewTitle: "Görsel incelemeye alındı",
      imageNeedsReviewBody: "Görsel yüklendi ancak kısa bir inceleme tamamlanana kadar yayında görünmeyebilir.",
      requiredFields: "Lütfen gerekli alanları doldur.",
      loginBeforeCreate: "İlan oluşturmadan önce lütfen giriş yap.",
      createFailed: "İlan oluşturulamadı",
      formTrustNote: "Detaylar, fotoğraflar, fiyat ve gizlilik kontrolleri netleşmeden ilanı yayınlama.",
      suggestListingDetails: "İlan detayları öner",
      suggesting: "Öneriliyor...",
      creating: "Oluşturuluyor...",
      aiSuggestionUnavailable: "AI önerisi kullanılamıyor",
      aiNeedsDetails: "Öneri istemeden önce en az bir ilan detayı ekle.",
      aiUnavailableManual: "AI önerisi şu anda kullanılamıyor. Elle devam edebilirsin.",
      aiSuggestionLabel: "AI ilan önerisi",
      aiSuggestionTitle: "AI önerisi",
      suggestedTagsLabel: "Önerilen etiketler",
      confidence: "güven",
      myListingsEyebrow: "Satıcı alanı",
      myListingsTitle: "Satıcı ilan yönetimi",
      myListingsDescription: "Satıcı alanındaki ilan kalitesini, uygunluk durumunu, yayındaki görünürlüğü, görselleri, fiyatı ve yaşam döngüsü işlemlerini yönet.",
      myListingsAriaLabel: "İlanlarım",
      loginToViewMyListings: "İlanlarını görmek için lütfen giriş yap.",
      loadingMyListings: "İlanların yükleniyor",
      myListingsUnavailable: "İlanlar kullanılamıyor",
      noListingsTitle: "Henüz ilan yok.",
      noListingsBody: "İlk BabyLoop ilanını oluştur, ardından görselleri, fiyatı, durumu ve alıcıya görünen kaliteyi buradan yönet.",
      sellItem: "Ürün sat",
      editListing: "Düzenle",
      saveChanges: "Değişiklikleri kaydet",
      saving: "Kaydediliyor...",
      cancelEdit: "Vazgeç",
      markReserved: "Ayrıldı olarak işaretle",
      markSold: "Satıldı olarak işaretle",
      archiveListing: "Arşivle",
      reactivateListing: "Tekrar aktif yap",
      notPublic: "Yayında değil",
      lifecycleActionFailed: "İlan işlemi başarısız",
      lifecycleActionsAriaLabel: "İlan yaşam döngüsü işlemleri",
      imageMetadata: "Görsel bilgisi",
      noImage: "Görsel yok",
      browseEyebrow: "Pazarı keşfet",
      browseTitle: "Güvenilir bebek ihtiyaçlarını keşfet",
      browseResultsTitle: "\"{query}\" için sonuçlar",
      browseDescription:
        "Ebeveynlerin yayınladığı bebek ve çocuk ürünlerini bul. Favorilere kaydet ya da satıcıya mesaj atmak için ilana gir.",
      browseAriaLabel: "İlanları keşfet",
      categoriesTitle: "Kategoriler",
      categoriesAriaLabel: "Kategori filtresi alanı",
      categoriesNote: "Pazarda neler olduğunu anlamak için kategorileri kullan.",
      categoriesUnavailable: "Kategoriler şu anda kullanılamıyor.",
      noActiveListingsTitle: "Henüz aktif ilan yok.",
      noActiveListingsBody:
        "Eşleşen ilan yok. Farklı bir arama dene ya da daha sonra tekrar bak.",
      noProductImage: "Ürün görseli yok",
      productImageAlt: "{title} ürün görseli",
      typeLabel: "Tip",
      conditionLabel: "Durum",
      statusLabel: "Durum",
      favoriteCount: "Favori: {count}",
      loadingListingsTitle: "İlanlar yükleniyor",
      fetchingMarketplaceTitle: "Pazar verileri alınıyor",
      fetchingMarketplaceMessage: "BabyLoop API'den aktif ilanlar ve kategoriler okunuyor.",
      detailEyebrow: "İlan detayı",
      detailUnavailableTitle: "İlan kullanılamıyor",
      detailNotFoundTitle: "İlan bulunamadı",
      detailNotFoundDescription:
        "İlan pasif, kaldırılmış ya da mevcut örnek verilerde bulunmuyor olabilir.",
      loadingDetailTitle: "İlan yükleniyor",
      fetchingDetailTitle: "İlan detayı alınıyor",
      fetchingDetailMessage: "Bu ilan BabyLoop API'den okunuyor.",
      imageGalleryAriaLabel: "İlan görsel galerisi",
      detailImageAlt: "{title} ürün görseli {index}",
      imageUnavailable: "Görsel kullanılamıyor",
      noPhotosTitle: "Fotoğraf eklenmemiş.",
      noPhotosBody: "Karar vermeden önce satıcıdan daha fazla fotoğraf iste.",
      browseListings: "İlanları keşfet",
      noDescription: "Henüz açıklama eklenmemiş.",
      listingActionsAriaLabel: "İlan işlemleri",
      location: "Konum",
      created: "Oluşturulma",
      updated: "Güncellenme",
      sellerInformationAriaLabel: "Satıcı bilgisi",
      seller: "Satıcı",
      locationNotProvided: "Konum belirtilmedi"
    },
    messaging: {
      eyebrow: "Mesajlar",
      conversationsTitle: "Konuşmalar",
      conversationsDescription: "Alıcı ve satıcı mesajlarını her profil eşleşmesi için tek konuşmada tut.",
      conversationTitle: "Konuşma",
      conversationWith: "Konuşulan kişi",
      listing: "İlan",
      noListingContext: "İlan bağlantısı yok",
      lastMessage: "Son mesaj",
      updated: "Güncellendi",
      created: "Oluşturuldu",
      loadingConversations: "Konuşmalar yükleniyor",
      loginToViewConversations: "Konuşmalarını görmek için lütfen giriş yap.",
      loginRequired: "Giriş gerekli",
      messagesUnavailable: "Mesajlar kullanılamıyor",
      noConversationsTitle: "Henüz konuşma yok.",
      noConversationsBody: "Bir satıcıya mesaj atmak için ilan detay sayfasından başla.",
      open: "Aç",
      statusLabel: "Durum",
      noMessagesSent: "Henüz mesaj gönderilmedi.",
      loadingConversation: "Konuşma yükleniyor",
      loginToViewConversation: "Bu konuşmayı görmek için lütfen giriş yap.",
      backToMessages: "Mesajlara dön",
      accessDenied: "Erişim reddedildi",
      conversationNotFound: "Konuşma bulunamadı",
      conversationUnavailable: "Konuşma kullanılamıyor",
      noMessagesYet: "Henüz mesaj yok.",
      sendFirstMessage: "İlk mesajı aşağıdan gönder.",
      you: "Sen",
      deletedMessage: "Bu mesaj silindi.",
      messageLabel: "Mesaj",
      messagePlaceholder: "Kısa bir mesaj yaz",
      emptyMessage: "Mesaj boş olamaz.",
      messageBlocked: "Bu mesaj uygunsuz içerik içerdiği için gönderilemez.",
      invalidMessageBody: "Mesaj yalnızca güvenli düz metin içerebilir. HTML veya script kullanılamaz.",
      sendFailed: "Mesaj gönderilmedi",
      participantsOnly: "Mesajlar yalnızca konuşma katılımcıları tarafından görülür.",
      sending: "Gönderiliyor...",
      sendMessage: "Mesaj gönder",
      newMessages: "Yeni mesajlar",
      unreadConversation: "Okunmamış konuşma",
      loginToMessageSeller: "Satıcıya mesaj atmak için giriş yap",
      checkingSeller: "Satıcı kontrol ediliyor",
      ownListing: "Bu senin ilanın",
      opening: "Açılıyor...",
      messageSeller: "Satıcıya mesaj at",
      messagingUnavailable: "Mesajlaşma kullanılamıyor"
    },
    notifications: {
      eyebrow: "Bildirimler",
      title: "Bildirim merkezi",
      description: "BabyLoop profilin için mesaj, ilan ve pazar güncellemelerini görüntüle.",
      loading: "Bildirimler yükleniyor",
      unavailable: "Bildirim merkezi kullanılamıyor",
      unreadCount: "{count} okunmamış bildirim",
      markAsRead: "Okundu olarak işaretle",
      markAllRead: "Tümünü okundu işaretle",
      markingAllRead: "İşaretleniyor...",
      read: "Okundu",
      emptyTitle: "Henüz bildirim yok.",
      emptyBody: "Yeni mesaj ve pazar güncellemeleri burada görünecek.",
      actionFailed: "Bildirim işlemi başarısız",
      messageReceived: "Yeni mesaj",
      listingFavorited: "İlan favorilendi",
      listingFavoritedBody: "Bir kullanıcı ilanını favoriye ekledi.",
      listingStatusChanged: "İlan durumu değişti",
      viewConversation: "Konuşmayı görüntüle",
      viewListing: "İlanı görüntüle",
      typeLabels: {
        message_received: "Mesaj",
        listing_favorited: "Favori",
        listing_status_changed: "İlan durumu",
        system: "Sistem"
      }
    },
    safety: {
      safetyActionsAriaLabel: "Güvenlik işlemleri",
      reportListing: "İlanı bildir",
      reportUser: "Kullanıcıyı bildir",
      reportMessage: "Mesajı bildir",
      blockUser: "Kullanıcıyı engelle",
      unblockUser: "Engeli kaldır",
      userBlocked: "Kullanıcı engellendi.",
      userUnblocked: "Kullanıcı engeli kaldırıldı.",
      cannotMessageUser: "Bu kullanıcıyla mesajlaşamazsın.",
      cannotBlockSelf: "Kendini engelleyemezsin.",
      cannotReportSelf: "Kendini bildiremezsin.",
      messagingBlockedTitle: "Mesajlaşma engellendi",
      reason: "Neden",
      details: "Detaylar",
      detailsPlaceholder: "Moderasyon ekibi için isteğe bağlı bilgi ekle.",
      submitReport: "Bildirimi gönder",
      submitting: "Gönderiliyor...",
      cancel: "Vazgeç",
      updating: "Güncelleniyor...",
      reportSubmittedTitle: "Bildirim gönderildi",
      reportSubmitted: "Bildirim gönderildi.",
      actionComplete: "İşlem tamamlandı",
      actionFailed: "Güvenlik işlemi başarısız",
      reasons: {
        safety: "Güvenlik endişesi",
        scam: "Dolandırıcılık veya şüpheli davranış",
        inappropriate: "Uygunsuz içerik",
        prohibited_item: "Yasaklı ürün",
        harassment: "Taciz",
        other: "Diğer"
      }
    },
    marketplace: {
      favoritesTitle: "Kaydedilen ilan kısa listesi",
      favoritesDescription: "Satıcılara mesaj atmadan önce kaydettiğin ilanları karşılaştır, eskimiş kayıtları temizle ve daha iyi alıcı soruları hazırla.",
      favoritesLogin: "Kaydettiğin ilanları görmek için lütfen giriş yap.",
      favoritesUnavailable: "Favoriler kullanılamıyor",
      favoritesEmptyTitle: "Henüz kaydedilmiş ilan yok.",
      favoritesEmptyBody: "Pazarı keşfet, ilan detaylarını aç ve mesaj atmadan önce karşılaştırmak istediğin ürünleri kaydet.",
      loadingFavorites: "Kaydedilen ilanlar yükleniyor",
      favoritesEyebrow: "Profilin",
      favoritesAriaLabel: "Favori ilanlar",
      savedDate: "{date} tarihinde kaydedildi",
      favoriteActionFailed: "Favori işlemi başarısız",
      favoriteLoginRequired: "Favorilere kaydetmeden önce lütfen giriş yap.",
      savingFavorite: "Kaydediliyor...",
      favorite: "Favori",
      unfavorite: "Favoriden çıkar"
    },
    admin: {
      title: "BabyLoop Admin",
      description: "Moderasyon ve güvenlik işlemleri için minimal admin çalışma alanı.",
      backToAdmin: "Admin paneline dön",
      backToMarketplace: "Pazara dön",
      auth: {
        checkingTitle: "Admin",
        checkingBody: "Admin erişimi kontrol ediliyor...",
        requiredTitle: "Admin erişimi gerekli",
        requiredBody: "Admin alanını açmadan önce giriş yapmalısın.",
        forbiddenTitle: "Erişim engellendi",
        forbiddenBody: "Bu hesabın admin yetkisine sahip değil.",
        currentRole: "Mevcut rol",
        checkFailedTitle: "Admin erişim kontrolü başarısız",
        checkFailedBody: "BabyLoop admin yetkilerini doğrulayamadı.",
        signIn: "Giriş yap"
      },
      moderation: {
        title: "Moderasyon",
        description: "Raporlanan ilanları, profilleri ve mesajları incele. Case durumunu güncelle ve audit notları ekle.",
        openCases: "Moderasyon kayıtlarını aç",
        casesTitle: "Moderasyon kayıtları",
        casesDescription: "Raporlanan pazar içeriğini incele ve her moderasyon kaydı için audit izi tut.",
        all: "Tümü",
        pending: "Beklemede",
        inReview: "İncelemede",
        resolved: "Çözüldü",
        dismissed: "Reddedildi",
        loadingCases: "Moderasyon kayıtları yükleniyor...",
        loadCasesFailedTitle: "Moderasyon kayıtları yüklenemedi",
        noCasesTitle: "Moderasyon kaydı bulunamadı",
        noCasesBody: "Seçili filtre için kayıt yok.",
        openCase: "Kaydı aç",
        caseLabel: "Kayıt",
        status: "Durum",
        subject: "Konu",
        reason: "Sebep",
        details: "Detaylar",
        created: "Oluşturulma",
        updated: "Güncellenme",
        caseTitle: "Moderasyon kaydı",
        loadingCase: "Moderasyon kaydı yükleniyor...",
        loadCaseFailedTitle: "Moderasyon kaydı yüklenemedi",
        backToCases: "Moderasyon kayıtlarına dön",
        auditActionsTitle: "Audit işlemleri",
        auditActionsDescription: "Bu moderasyon kaydı için durum değişiklikleri ve admin notları.",
        noAuditActions: "Bu kayıt için henüz audit işlemi yok.",
        type: "Tip",
        note: "Not",
        adminUser: "Admin kullanıcı",
        updateStatusTitle: "Durumu güncelle",
        updateStatusDescription: "Bu moderasyon kaydını inceleme akışında ilerlet.",
        updateStatus: "Durumu güncelle",
        updating: "Güncelleniyor...",
        statusUpdated: "Moderasyon kaydı durumu güncellendi.",
        addActionTitle: "Admin işlemi ekle",
        addActionDescription: "Moderasyon notu veya audit işlemi ekle. Bu işlem tek başına silme/askıya alma gibi yıkıcı işlem yapmaz.",
        actionType: "İşlem tipi",
        adminNote: "Admin notu",
        adminNotePlaceholder: "Bu moderasyon kaydı için kısa bir audit notu yaz.",
        adminNoteRequired: "Admin notu zorunludur.",
        addAction: "İşlem ekle",
        adding: "Ekleniyor...",
        actionAdded: "Admin işlemi audit geçmişine eklendi.",
        actionTaken: "İşlem yapıldı",
        reviewStarted: "İnceleme başladı"
      }
    }
  }
} as const;

export type Dictionary = (typeof dictionaries)[Locale];
