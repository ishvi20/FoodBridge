# 🍲 FoodBridge – Connecting Surplus Food with People in Need

**FoodBridge** is a web-based food donation platform designed to reduce food wastage by connecting food donors, NGOs, and volunteers.

The platform allows restaurants, hotels, pg, hostel and other food donors to share surplus food with NGOs, who can claim donations and coordinate their delivery with volunteers.

Our goal is simple: **Zero Food Waste, Zero Hunger.**

## 🌟 Key Features

- **User Authentication:** Secure registration and login using Firebase Authentication.
- **Multiple User Roles:** Separate dashboards for Donors, NGOs, Volunteers, and Admins.
- **Food Donations:** Donors can post details about available surplus food.
- **Donation Discovery:** NGOs can browse available food donations.
- **Food Claiming:** NGOs can claim available donations.
- **Volunteer Coordination:** Volunteers can participate in food delivery.
- **Admin Dashboard:** Administrators can manage users and donations.
- **User Verification:** Admins can verify registered users.
- **Location Support:** Location-based information to help connect donors and recipients.

## 🛠️ Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Website structure |
| CSS3 | Styling and responsive interface |
| JavaScript | Frontend functionality |
| Firebase Authentication | User authentication |
| Cloud Firestore | Database management |
| Leaflet.js | Interactive maps and location support |

## 👥 User Roles

1. **Food Donor:** Posts details of surplus food available for donation.
2. **NGO:** Discovers and claims available food donations.
3. **Volunteer:** Helps coordinate food pickup and delivery.
4. **Admin:** Manages users, verifies accounts, and oversees donations.

## ⚙️ Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/ishvi20/FoodBridge.git
```

### 2. Open the Project

```bash
cd FoodBridge
```

### 3. Configure Firebase

- Create a Firebase project.
- Register a Web App in Firebase.
- Enable Email/Password Authentication.
- Create a Cloud Firestore database.
- Configure your Firebase web credentials in `firebase-config.js`.
- Deploy the Firestore security rules from `firestore.rules`.

### 4. Run the Application

Open the project using VS Code and launch `index.html` with the Live Server extension.

## 📁 Project Structure

```text
FoodBridge/
│
├── index.html
├── style.css
├── script.js
├── firebase-config.js
├── firebase.json
├── firestore.rules
├── README.md
└── .gitignore
```

## 🎯 Project Objective

FoodBridge aims to create a simple and accessible digital platform that reduces food wastage and makes surplus food available to people who need it.

By connecting donors, NGOs, and volunteers, the platform encourages responsible food distribution and community participation.

## 👩‍💻 Developer

**Ishvi Goyal**

GitHub: [@ishvi20](https://github.com/ishvi20)

---

**FoodBridge – Bridging Surplus Food and Hungry Stomachs.**

*Zero Waste. Zero Hunger.* 🍲
