# Tomo AI: Server Repository

Tomo AI is a **Generative AI-based Prompt Web Application** designed to enhance effective learning in education. By leveraging the OpenAI API and Langchain, Tomo AI provides students and professors with an efficient platform for course-specific information retrieval and management.
Tomo AI tackles the challenge of having a 
---

### 🔗 Client Repository
Find the server repository [here](https://github.com/huzaifazia17/TomoAIClient).

---

## Challenges Tomo AI Tackles

Tomo AI is designed to address common challenges in education:

- **Document Security**: Ensures that only authorized users (e.g., professors or students) can access sensitive course materials.
- **Efficient Student Management**: Professors can easily add/remove students from their courses, streamlining administrative tasks.
- **Slide Content Retrieval**: Students often struggle to find specific information in lecture slides. Tomo AI provides precise answers from uploaded documents, saving time.
- **Customizable Document Visibility**: Professors can manage which documents are visible to students, tailoring the learning experience.
- **Reduced Professor/TA Workload**: By automating responses to common questions, Tomo AI frees up educators' time for more critical tasks.

---

## 🚀 Features
### 1. **User Authentication**
- Seamless authentication powered by **Firebase**.

### 2. **Custom User Interface**
- Tailored features and UI for:
  - **Professors**: Manage spaces and documents.
  - **Students**: Access course-specific content and ask AI-powered questions.

### 3. **Space (Course) Management Dashboard**
Professors can:
- **Add/Remove Students**: Manage class rosters effortlessly.
- **Add/Remove Documents**: Upload or remove course materials students can query.
- **Toggle Document Visibility**: Control which documents are accessible to students.

### 4. **Accurate AI Responses**
- Enhanced by **OpenAI API** and **Langchain**, the system provides context-aware responses to document-based and general queries with precision.

---

## 🎥 Demonstration Video
A short demonstration of the main features of Tomo AI has been recorded and is available to watch here:

[![Watch the Demo Video](https://img.youtube.com/vi/1Q8X6lE_hno/0.jpg)](https://youtu.be/1Q8X6lE_hno)

---

## 🛠️ Getting Started

### 1. Clone the Repositories
Start by cloning both the **Client** and **Server** repositories:
```bash
git clone https://github.com/huzaifazia17/TomoAIClient.git
git clone https://github.com/huzaifazia17/TomoAIServer.git
```

### 2. Set up the Environment Files
In the **Client** folder, create a .env file and add the following: 
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_id=your_firebase_measurement_id
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key
```
In the **Server** folder, create a .env file and add the following: 
```bash
MONGO_URI=your_mongodb_uri
OPENAI_API_KEY=your_openai_api_key
```

### 3. Install Dependencies
Run the following command in bothe the **Client** and **Server** folder:
```bash
npm install
```

### 4. Run the Application
**Server**:
Navigate to the server directory and run:
```bash
node server.js
```
**Client**:
Navigate to the client directory and run:
```bash
npm run dev
```
