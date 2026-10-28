# 🎓 Student Record Management System (AWS DynamoDB + EC2 Ready)

A lightweight, production-ready, single-service web application built with **Node.js**, **Express.js**, and the **AWS SDK for JavaScript v3** (`@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb`).

Designed with an **intelligent dual-mode storage engine**:
- 💻 **Locally**: Runs immediately out-of-the-box using an in-memory mock store if AWS credentials or tables aren't detected.
- ☁️ **On AWS EC2**: Instantly authenticates and connects to real Amazon DynamoDB via the EC2 Instance IAM Role (Default Credential Provider Chain) with **zero hardcoded keys**.

---

## 📁 Project Structure

```
├── .env.example          # Environment variable template
├── .env                  # Local environment configuration
├── .gitignore            # Ignores node_modules and secrets
├── package.json          # Dependencies & npm scripts
├── server.js             # Express application & REST API routes
├── db.js                 # AWS DynamoDB SDK v3 abstraction with Mock Fallback
├── README.md             # Architecture, local setup & deployment guide
└── public/               # Zero-build static frontend (served by Express)
    ├── index.html        # Clean, modern semantic UI & modals
    ├── style.css         # Dark theme, glassmorphism, responsive styles
    └── app.js            # Reactive CRUD frontend logic & toast system
```

---

## ⚡ Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(The defaults are pre-configured to `AWS_REGION=ap-south-1` and `DYNAMODB_TABLE_NAME=StudentRecords`).*

### 3. Start the Server
```bash
npm start
```
*(Or use `npm run dev` for auto-reloading with nodemon).*

Open your browser at **[http://localhost:3000](http://localhost:3000)**.

> **💡 Zero Setup Required Locally:**
> If you do not have AWS credentials configured locally, the server will display:
> `[Storage] ⚠️ AWS DynamoDB unreachable. Automatic Fallback: System initialized with in-memory mock data.`
> The web UI will show a glowing **Mock Mode: Local In-Memory** banner with sample test data pre-loaded!

---

## 🔌 API Endpoints Reference

| Method | Endpoint | Description | Sample Response / Notes |
|---|---|---|---|
| `GET` | `/health` | CloudWatch / ALB Health Check | `{"status":"ok","uptime":12.4,"storageMode":"mock"}` |
| `GET` | `/api/status` | DB & Connection Status | Connection mode, table name, region, count |
| `GET` | `/api/students` | List all student records | `{"success":true,"count":4,"data":[...]}` |
| `GET` | `/api/students/:id` | Get single student by ID | Fetches record with primary key `studentId` |
| `POST` | `/api/students` | Create new student record | Expects `{ studentId, name, course, email }` |
| `DELETE`| `/api/students/:id` | Delete student by ID | Deletes by partition key `studentId` |
| `POST` | `/api/status/recheck` | Re-test AWS DynamoDB Link | Probes live AWS connection on demand |
| `POST` | `/api/mock/reset` | Reset demo data | Resets in-memory storage to initial records |

---

## ☁️ Connecting to Real AWS DynamoDB

### Step 1: Create the DynamoDB Table
1. Open the [AWS Management Console](https://console.aws.amazon.com/dynamodb/).
2. Click **Create table**:
   - **Table name**: `StudentRecords`
   - **Partition key**: `studentId` (Type: **String**)
   - **Table class**: *DynamoDB Standard* (On-Demand capacity recommended for testing)
3. Click **Create table**.

### Step 2: Option A - Local Testing with AWS Credentials (Optional)
If you wish to connect to AWS from your local machine, add your temporary IAM User keys to `.env`:
```env
AWS_REGION=ap-south-1
DYNAMODB_TABLE_NAME=StudentRecords
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```
Restart the server, and the UI status will turn into glowing emerald **Connected: AWS DynamoDB**!

---

## 🚀 Deploying to AWS EC2 (Best Practice: IAM Role)

No credentials should ever be stored on the EC2 instance. The application leverages the **AWS Default Credential Provider Chain**.

### Step 1: Create an IAM Role for EC2
1. In AWS Console, go to **IAM** > **Roles** > **Create role**.
2. Select **AWS service** and choose **EC2**.
3. Attach the permission policy:
   - For testing: `AmazonDynamoDBFullAccess`
   - Or least-privilege custom policy:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Action": [
             "dynamodb:DescribeTable",
             "dynamodb:PutItem",
             "dynamodb:GetItem",
             "dynamodb:Scan",
             "dynamodb:DeleteItem"
           ],
           "Resource": "arn:aws:dynamodb:ap-south-1:*:table/StudentRecords"
         }
       ]
     }
     ```
4. Name the role `EC2-DynamoDB-StudentRecords-Role` and save.

### Step 2: Attach IAM Role to EC2 Instance
1. In EC2 Console, select your EC2 instance.
2. Click **Actions** > **Security** > **Modify IAM role**.
3. Select `EC2-DynamoDB-StudentRecords-Role` and click **Update IAM role**.

### Step 3: Run Application on EC2
SSH into your EC2 instance:
```bash
# 1. Install Node.js (v20 or v22)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# 2. Clone the repository
git clone <your-repo-url> student-records
cd student-records

# 3. Install production dependencies
npm install --production

# 4. Create .env with NO ACCESS KEYS (Region and Table name only)
cat <<EOF > .env
PORT=80
AWS_REGION=ap-south-1
DYNAMODB_TABLE_NAME=StudentRecords
FORCE_MOCK_MODE=false
EOF

# 5. Start with PM2 or systemd for 24/7 reliability
sudo npm install -g pm2
sudo pm2 start server.js --name "student-records"
sudo pm2 startup
sudo pm2 save
```

### Step 4: Configure EC2 Security Group
Ensure the EC2 Security Group allows:
- **Inbound HTTP (Port 80 or 3000)** from `0.0.0.0/0` (or your IP).

Navigate to `http://<your-ec2-public-ip>/` in your browser. The app will immediately recognize the EC2 IAM Role and display:
```
Connected to AWS DynamoDB (Table: StudentRecords, Region: ap-south-1)
```

---

## 🩺 AWS CloudWatch & Auto Scaling Integration

The `/health` endpoint is lightweight and returns HTTP 200:
```json
{
  "status": "ok",
  "uptime": 1284.52,
  "storageMode": "dynamodb",
  "timestamp": "2026-10-22T13:50:00.000Z"
}
```
Use this path (`/health`) in your:
- AWS Application Load Balancer (ALB) Target Group Health Checks
- EC2 Auto Scaling Group Health Check
- CloudWatch Synthetics Canaries
