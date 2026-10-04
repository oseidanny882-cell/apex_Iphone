import { defineConfig } from 'vite';

export default defineConfig({
  // Relative on purpose. It keeps every asset reference working when the site is
  // served from a subpath such as https://<user>.github.io/apex_Iphone/, which is
  // where GitHub Pages puts a project site. An absolute "/" base resolves assets
  // against the domain root and 404s every one of them.
  base: './',
  build: {
    // Plain "dist". The previous build used an APPDEPLOY_VITE_OUT_DIR override
    // supplied by the old static host; nothing needs it now, and leaving it in
    // meant a stray variable could silently redirect the output directory.
    outDir: 'dist',
    target: 'es2022',
    rollupOptions: {
      maxParallelFileOps: 128,
      input: {
        index: 'index.html',
        about: 'about.html',
        account: 'account.html',
        cart: 'cart.html',
        checkout: 'checkout.html',
        contact: 'contact.html',
        faq: 'faq.html',
        forgotPassword: 'forgot-password.html',
        login: 'login.html',
        orderDetails: 'order-details.html',
        orders: 'orders.html',
        privacy: 'privacy.html',
        product: 'product.html',
        profile: 'profile.html',
        register: 'register.html',
        resetPassword: 'reset-password.html',
        shipping: 'shipping.html',
        shop: 'shop.html',
        terms: 'terms.html',
        verifyEmail: 'verify-email.html',
        verify: 'verify.html',
        wishlist: 'wishlist.html',
      },
    },
  },
});
