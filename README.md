# FoodBridge (Firebase edition)

Real accounts + shared real-time data using Firebase Auth and Cloud Firestore (free Spark plan is enough).

## 1. Create the Firebase project
1. https://console.firebase.google.com → **Add project**.
2. **Build → Authentication → Get started →** enable **Email/Password**.
3. **Build → Firestore Database → Create database** (production mode, pick a region e.g. `asia-south1`).
4. **Project settings → Your apps → Web (</>)** → register app → copy the `firebaseConfig` values into `firebase-config.js`.
5. **Firestore → Rules** → paste the contents of `firestore.rules` → **Publish**.

## 2. Run it
ES modules and Firebase Auth do not work from `file://`. Use any local server:

    npx serve .            # or:  python3 -m http.server 8000

then open http://localhost:3000 (or :8000). `localhost` is authorised in Firebase by default.

## 3. Create the first admin
1. Register a normal account on the site (any role).
2. Firebase Console → Firestore → `users` → open that user's document.
3. Change `role` to `admin` and `verified` to `true`. Log in again.
4. The admin can now verify donors, NGOs and volunteers from the dashboard.

## 4. Put it online
    npm i -g firebase-tools
    firebase login
    firebase init        # choose Hosting + Firestore, use existing project, keep firebase.json / firestore.rules
    firebase deploy

Your site will be live at https://YOUR_PROJECT.web.app

## Notes / known limits
- "Remove" on a user deletes only their profile (Firestore). Deleting the login itself needs the Firebase console or an admin backend (Cloud Function).
- Verified users can see other verified users' phone/address (needed for pickups). Unverified users see nothing.
- Volunteer live GPS writes to Firestore every ~3 s per active delivery — fine for free tier at small scale.
- Next steps: phone OTP login, push/WhatsApp alerts (Cloud Functions + FCM), handover OTP, photo upload (Firebase Storage).
