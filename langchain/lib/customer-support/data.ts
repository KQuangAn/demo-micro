/**
 * ══════════════════════════════════════════════════════════════════
 *  Customer Support — Knowledge Base Data
 * ══════════════════════════════════════════════════════════════════
 *
 *  FAQ articles, policies, and troubleshooting guides that get
 *  seeded into Pinecone. The support agent retrieves these via
 *  RAG to answer customer questions accurately.
 *
 * ══════════════════════════════════════════════════════════════════
 */

export interface KnowledgeArticle {
  id: string;
  title: string;
  category: "billing" | "shipping" | "returns" | "account" | "product" | "technical";
  content: string;
  tags: string[];
}

export const knowledgeBase: KnowledgeArticle[] = [
  // ─── Billing ────────────────────────────────────────────────────
  {
    id: "billing-001",
    title: "Payment Methods",
    category: "billing",
    content: `We accept the following payment methods:
- Visa, Mastercard, American Express, and Discover credit/debit cards
- PayPal
- Apple Pay and Google Pay
- Bank transfer (ACH) for orders over $500
- Buy Now, Pay Later through Klarna (available for orders $50-$1000)

All payments are processed securely through Stripe. We never store your full card number on our servers. For recurring subscriptions, your payment method is charged automatically on the billing date shown in your account settings.`,
    tags: ["payment", "credit card", "paypal", "apple pay", "klarna"],
  },
  {
    id: "billing-002",
    title: "Refund Policy",
    category: "billing",
    content: `Refunds are processed within 5-7 business days after we receive and inspect the returned item. The refund goes back to your original payment method.

- Credit/debit cards: 5-7 business days after processing
- PayPal: 3-5 business days
- Bank transfer: 7-10 business days
- Klarna: Adjusted automatically in your Klarna account

If you haven't received your refund after 10 business days, please contact your bank first, then reach out to our support team with your order number.

Partial refunds may be issued if the item shows signs of use or if original packaging is missing. Restocking fees of 15% apply to electronics returned after 15 days.`,
    tags: ["refund", "money back", "return", "credit"],
  },
  {
    id: "billing-003",
    title: "Subscription Plans and Pricing",
    category: "billing",
    content: `We offer three subscription tiers:

**Free Plan** — $0/month
- Up to 5 projects
- 1 GB storage
- Community support
- Basic analytics

**Pro Plan** — $19/month (or $190/year — save 17%)
- Unlimited projects
- 50 GB storage
- Priority email support (24h response)
- Advanced analytics and reports
- Custom integrations

**Enterprise Plan** — Custom pricing
- Everything in Pro
- Unlimited storage
- Dedicated account manager
- Phone support
- SSO and SAML
- SLA guarantee (99.9% uptime)
- Custom onboarding

You can upgrade, downgrade, or cancel anytime. Downgrades take effect at the end of your current billing cycle. No cancellation fees.`,
    tags: ["pricing", "subscription", "plan", "free", "pro", "enterprise", "upgrade", "cancel"],
  },

  // ─── Shipping ───────────────────────────────────────────────────
  {
    id: "shipping-001",
    title: "Shipping Options and Delivery Times",
    category: "shipping",
    content: `We ship to all 50 US states and over 30 countries worldwide.

**Domestic (US) Shipping:**
- Standard: 5-7 business days — FREE for orders over $50, otherwise $4.99
- Express: 2-3 business days — $12.99
- Next Day: 1 business day — $24.99 (order by 2 PM EST)

**International Shipping:**
- Standard: 10-15 business days — $14.99
- Express: 5-7 business days — $29.99

Orders are processed within 1-2 business days. You'll receive a tracking number via email once your order ships. Tracking is available at our website or through the carrier's website.

Note: International orders may be subject to customs duties and taxes, which are the responsibility of the recipient.`,
    tags: ["shipping", "delivery", "tracking", "international", "domestic", "free shipping"],
  },
  {
    id: "shipping-002",
    title: "Order Tracking",
    category: "shipping",
    content: `To track your order:
1. Go to "My Orders" in your account dashboard
2. Click the order number you want to track
3. Click "Track Package" — this opens the carrier tracking page

You can also track directly using the tracking number from your shipping confirmation email:
- USPS: https://tools.usps.com/go/TrackConfirmAction
- UPS: https://www.ups.com/track
- FedEx: https://www.fedex.com/fedextrack
- DHL: https://www.dhl.com/us-en/home/tracking.html

If your tracking hasn't updated in 48 hours, please contact us. If your package shows "delivered" but you haven't received it, check with neighbors, your building manager, or safe spots around your delivery area. If still missing after 24 hours, contact us for a replacement or refund.`,
    tags: ["tracking", "order status", "package", "delivery", "missing package"],
  },

  // ─── Returns ────────────────────────────────────────────────────
  {
    id: "returns-001",
    title: "Return Policy",
    category: "returns",
    content: `We offer a 30-day return policy for most items. Items must be:
- In original condition (unworn, unwashed, undamaged)
- In original packaging with all tags attached
- Accompanied by proof of purchase (order number or receipt)

**How to initiate a return:**
1. Log into your account → My Orders → Select order
2. Click "Return Item" and select the reason
3. Print the prepaid return label (free for US returns)
4. Drop off at any USPS or UPS location

**Non-returnable items:**
- Personalized/custom items
- Perishable goods
- Intimate apparel and swimwear (hygiene reasons)
- Gift cards
- Digital downloads
- Items marked "Final Sale"

Exchanges: If you'd like a different size or color, initiate a return and place a new order. We recommend placing the new order right away to ensure availability.`,
    tags: ["return", "exchange", "return policy", "return label", "non-returnable"],
  },
  {
    id: "returns-002",
    title: "Damaged or Defective Items",
    category: "returns",
    content: `If you received a damaged or defective item:

1. **Take photos** of the damage (item + packaging)
2. Contact us within 48 hours of delivery
3. Provide your order number and the photos
4. We'll send a replacement or issue a full refund — your choice

We cover all return shipping costs for damaged/defective items. You don't need to return the damaged item in most cases — we'll let you know if we need it back.

For items damaged during use within the warranty period (if applicable), please refer to the product's warranty terms or contact us with photos and a description of the issue.`,
    tags: ["damaged", "defective", "broken", "warranty", "replacement"],
  },

  // ─── Account ────────────────────────────────────────────────────
  {
    id: "account-001",
    title: "Password Reset and Account Recovery",
    category: "account",
    content: `**To reset your password:**
1. Go to the login page and click "Forgot Password?"
2. Enter the email address associated with your account
3. Check your email for a reset link (check spam/junk folder too)
4. Click the link and create a new password
5. Password must be at least 8 characters with one uppercase, one number, and one special character

The reset link expires after 1 hour. If expired, request a new one.

**Locked out of your account?**
After 5 failed login attempts, your account is locked for 30 minutes. If you still can't access your account:
- Try the password reset flow
- If your email is no longer accessible, contact support with your account details and a government-issued ID for verification

**Two-Factor Authentication (2FA):**
If you lose access to your 2FA device, use one of the backup codes provided during setup. If you don't have backup codes, contact support for manual verification (takes 24-48 hours).`,
    tags: ["password", "reset", "login", "locked out", "2fa", "account recovery"],
  },
  {
    id: "account-002",
    title: "Account Deletion and Data Privacy",
    category: "account",
    content: `**To delete your account:**
1. Go to Settings → Account → Delete Account
2. Confirm by entering your password
3. You'll receive a confirmation email

Account deletion is permanent and takes effect after a 14-day grace period. During this time, you can cancel the deletion by logging back in.

**What happens when you delete:**
- All personal data is permanently removed
- Order history is anonymized (we keep transaction records for tax/legal purposes)
- Active subscriptions are canceled immediately
- Any remaining balance or credits are forfeited
- Content you've created (reviews, comments) is anonymized

**Data export:** Before deleting, you can export your data from Settings → Privacy → Export My Data. This includes your profile, order history, and saved preferences in JSON format.

We comply with GDPR, CCPA, and other applicable privacy regulations. For data-related requests, email privacy@acmestore.com.`,
    tags: ["delete account", "privacy", "gdpr", "data export", "ccpa"],
  },

  // ─── Product ────────────────────────────────────────────────────
  {
    id: "product-001",
    title: "Product Warranty Information",
    category: "product",
    content: `All products come with the manufacturer's warranty:

**Electronics:** 1-year limited warranty covering manufacturing defects. Does not cover physical damage, water damage, or unauthorized modifications.

**Furniture:** 2-year warranty on structural components. 90-day warranty on fabric and cushioning.

**Clothing:** 90-day warranty against defects in materials and workmanship (does not cover normal wear and tear).

**How to file a warranty claim:**
1. Contact support with your order number and a description of the issue
2. Provide photos or videos showing the defect
3. We'll review within 2-3 business days
4. If approved, we'll send a replacement or provide store credit

Extended warranty plans are available for electronics at checkout (adds 1 extra year for 10% of item price).`,
    tags: ["warranty", "guarantee", "defect", "claim", "extended warranty"],
  },
  {
    id: "product-002",
    title: "Size Guide and Fit Recommendations",
    category: "product",
    content: `**How to find your size:**
Each product page has a "Size Guide" link with detailed measurements. We recommend measuring yourself and comparing to our charts rather than relying on sizes from other brands.

**Key measurements:**
- Chest: Measure around the fullest part
- Waist: Measure at your natural waistline
- Hips: Measure around the fullest part
- Inseam: Measure from crotch to ankle

**Fit tips:**
- Our sizing runs true to standard US sizes
- If you're between sizes, we recommend sizing up for a relaxed fit
- Customer reviews often include fit feedback — check the "Fit" filter
- Items marked "Slim Fit" run approximately one size smaller

**Still unsure?** Our AI size recommender uses your height, weight, and preferred fit to suggest the best size. Find it on any product page.`,
    tags: ["size", "sizing", "fit", "measurements", "size guide"],
  },

  // ─── Technical Support ──────────────────────────────────────────
  {
    id: "technical-001",
    title: "Mobile App Troubleshooting",
    category: "technical",
    content: `**Common issues and fixes:**

**App won't load / crashes on startup:**
1. Force close the app and reopen
2. Check for app updates in the App Store / Google Play
3. Restart your device
4. Uninstall and reinstall the app (your account data is saved in the cloud)

**Can't log in on mobile:**
- Ensure you're using the correct email/password
- Check if Caps Lock is on
- Try "Forgot Password" to reset
- Ensure you have a stable internet connection

**Push notifications not working:**
1. Go to your device Settings → Notifications → Find our app
2. Ensure notifications are enabled
3. In the app: Settings → Notifications → Toggle on the types you want

**App is slow / laggy:**
- Clear the app cache: Settings → Storage → Clear Cache
- Ensure you're on a stable WiFi or cellular connection
- Update to the latest app version
- If on Android, ensure battery optimization isn't restricting the app

**Minimum requirements:** iOS 15+ / Android 10+ / 100MB free storage`,
    tags: ["app", "mobile", "crash", "slow", "notifications", "login", "troubleshooting"],
  },
  {
    id: "technical-002",
    title: "API Integration and Developer Support",
    category: "technical",
    content: `**Getting started with our API:**
1. Generate an API key from Settings → Developer → API Keys
2. Read the documentation at https://docs.acmestore.com/api
3. Use your API key in the Authorization header: "Bearer YOUR_API_KEY"

**Rate limits:**
- Free plan: 100 requests/minute
- Pro plan: 1,000 requests/minute
- Enterprise: Custom limits

**Common endpoints:**
- GET /api/v2/products — List products
- GET /api/v2/orders — List your orders
- POST /api/v2/orders — Create an order
- GET /api/v2/inventory/{sku} — Check stock

**Webhooks:**
Configure webhooks in Settings → Developer → Webhooks to receive real-time notifications for:
- order.created, order.shipped, order.delivered
- payment.completed, payment.failed
- inventory.low_stock

**SDKs:** Official SDKs available for Node.js, Python, Ruby, Go, and Java.

For API issues, email api-support@acmestore.com or post in our developer forum.`,
    tags: ["api", "developer", "integration", "webhooks", "sdk", "rate limit"],
  },
];
