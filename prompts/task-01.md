# PATCH OVERRIDE: Document v24.1 (Surgical UI Stabilization)
**Target:** Root Gate `/signin`
**Rule:** Do not regenerate the whole page layout. Apply these 4 explicit overrides to the existing DOM nodes:

1. **KILL THE TOP-LEFT ECHO:**
   Locate the top-left header node. Force the string strictly to:
   `<span className="text-xs font-black tracking-widest text-blue-200 uppercase">HINIGARAN NATIONAL HIGH SCHOOL</span>`
   *(The string 'ENROLLPRO' is strictly banned from this specific parent div).*

2. **DE-SAUSAGE THE ROSTER CARDS:**
   Target the wrapper class of the 5 left-hand microservice cards. Change the border-radius and background tokens strictly to:
   `rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 p-4 transition-all shadow-sm`
   *(Crucial: Check your CSS; ensure `rounded-full` or `rounded-2xl` is completely stripped off these 5 cards).*

3. **ERADICATE THE ZOMBIE FOOTER:**
   Locate the absolute-positioned footer node at the bottom-left containing the text `"EnrollPro: Learner Enrollment and Sectioning System"`. **Delete this DOM node entirely.** It is causing an unreadable text-collision with the MRF card. Let the bottom of the MRF card sit over empty, clean blue space.

4. **SANITIZE THE LOGIN CARD HEADER:**
   Locate the circular blue badge at the top center of the white login card containing the "sparkles" icon. **Remove this circular badge entirely.** Re-anchor the H2 `"Sign In to Portal"` directly to the top margin of the card's internal padding.