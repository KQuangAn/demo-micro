# AWS IAM & Cognito — Learning Project

> A hands-on Node.js project to **deeply understand** IAM Roles, Cognito User Pools, and Cognito Identity Pools — and how they all connect.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                        This Project                                │
├────────────┬──────────────────┬──────────────────┬─────────────────┤
│  IAM Roles │  Cognito         │  Cognito         │  End-to-End     │
│            │  User Pool       │  Identity Pool   │  Flow           │
│            │                  │                  │                 │
│ • Create   │ • Sign-up        │ • Describe pool  │ • Sign in       │
│ • Assume   │ • Sign-in        │ • Exchange token │ • Get AWS creds │
│ • Temp     │ • Tokens (JWT)   │ • Get AWS creds  │ • Call S3       │
│   creds    │ • User mgmt      │ • Verify creds   │ • Compare IDs   │
│ • Inspect  │ • List users     │ • List identities│                 │
│ • Cleanup  │ • Delete user    │                  │                 │
├────────────┴──────────────────┴──────────────────┴─────────────────┤
│  Trust Policy Examples:                                            │
│  • Account root  • Specific user  • Lambda service                 │
│  • GitHub OIDC   • Cognito IdPool • Cross-account + ExternalId     │
├────────────────────────────────────────────────────────────────────┤
│  Comparison Guide: User Pool vs Identity Pool                      │
│  (when to use one, the other, or both)                             │
└────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

| Requirement | Why |
|---|---|
| **Node.js 18+** | Uses ES modules and `base64url` |
| **AWS Account** | To create real IAM roles and Cognito resources |
| **IAM User with permissions** | Needs `iam:*`, `sts:*`, `cognito-idp:*`, `cognito-identity:*` |
| **Cognito User Pool** | Create one via AWS Console (takes 2 min) |
| **Cognito Identity Pool** | Create one linked to your User Pool |

---

## Quick Start

### 1. Install dependencies

```bash
cd aws-iam-cognito-demo
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your AWS credentials and Cognito IDs
```

### 3. Run demos

```bash
# Interactive menu
node src/index.js

# Or run a specific demo directly
node src/index.js iam          # IAM Roles walkthrough
node src/index.js trust        # Trust Policy comparison table
node src/index.js userpool     # Cognito User Pool walkthrough
node src/index.js idpool       # Cognito Identity Pool walkthrough
node src/index.js compare      # User Pool vs Identity Pool comparison
node src/index.js e2e          # End-to-end flow

# Or run individual files
node src/iam/iam-roles.js
node src/iam/trust-policies.js
node src/cognito/user-pool.js
node src/cognito/identity-pool.js
node src/cognito/comparison.js
node src/e2e-flow.js
```

---

## Creating AWS Resources (if you don't have them yet)

### Create a Cognito User Pool (AWS Console)

1. Go to **Amazon Cognito** → **Create user pool**
2. Sign-in options: **Email**
3. Password policy: keep defaults (or customize)
4. MFA: **No MFA** (for this demo)
5. Self-service sign-up: **Enable**
6. Email: **Send email with Cognito** (free tier)
7. User pool name: `demo-learning-pool`
8. App client:
   - Name: `demo-app-client`
   - **No client secret** (for `USER_PASSWORD_AUTH`)
   - Auth flows: enable **`ALLOW_USER_PASSWORD_AUTH`** and `ALLOW_REFRESH_TOKEN_AUTH`
9. Create → copy the **User Pool ID** and **Client ID** to `.env`

### Create a Cognito Identity Pool (AWS Console)

1. Go to **Amazon Cognito** → **Federated Identities** → **Create new identity pool**
2. Identity pool name: `demo-learning-id-pool`
3. **Authentication providers** → **Cognito** tab:
   - User Pool ID: paste from above
   - App Client ID: paste from above
4. Create → AWS will create two IAM roles:
   - `Cognito_demo_Auth_Role` (for signed-in users)
   - `Cognito_demo_Unauth_Role` (for guests)
5. Copy the **Identity Pool ID** to `.env`

---

## Project Structure

```
aws-iam-cognito-demo/
├── .env.example           # Template for environment variables
├── .gitignore
├── package.json
├── README.md
└── src/
    ├── index.js           # Interactive demo runner
    ├── config.js           # Loads .env configuration
    ├── e2e-flow.js         # End-to-end: sign in → get AWS creds → call S3
    ├── iam/
    │   ├── iam-roles.js    # Create, assume, inspect, cleanup IAM roles
    │   └── trust-policies.js  # All 6 types of trust policies explained
    └── cognito/
        ├── user-pool.js    # Sign-up, sign-in, tokens, user management
        ├── identity-pool.js # Token exchange → AWS credentials
        └── comparison.js   # User Pool vs Identity Pool side-by-side
```

---

## Key Concepts Explained

### IAM Roles — The "Hat" Analogy

An IAM Role is like a **hat with powers**. Anyone trusted can put it on temporarily and gain its abilities. When they take it off, they lose those powers.

| Concept | What It Does |
|---|---|
| **Trust Policy** | Who is allowed to wear the hat |
| **Permission Policy** | What the hat lets you do |
| **AssumeRole** | The act of putting on the hat |
| **Temp Credentials** | The powers you get while wearing it |
| **Session Duration** | How long before the hat disappears |

### Cognito User Pool vs Identity Pool

```
User Pool = Your app's login system
             (stores users, handles passwords, issues JWTs)

Identity Pool = AWS credential vending machine
                (accepts JWTs, dispenses temporary AWS keys)
```

**When you need what:**

| Scenario | What You Need |
|---|---|
| Web API with login | User Pool only |
| Mobile app uploading to S3 | User Pool + Identity Pool |
| Guest analytics tracking | Identity Pool only (unauth) |
| Social login (Google/Facebook) | Either or both |

---

## Common Gotchas

1. **User Pool tokens ≠ AWS credentials**
   - User Pool issues JWTs for YOUR application
   - To get AWS credentials, you need an Identity Pool

2. **IAM propagation delay**
   - After creating a role, wait ~10s before assuming it
   - IAM is eventually consistent

3. **App Client must allow USER_PASSWORD_AUTH**
   - If you get `InvalidParameterException`, enable this flow in the app client settings

4. **Identity Pool requires the provider to be configured**
   - The User Pool ID + Client ID must be registered in the Identity Pool's "Authentication providers"

5. **Token expiration**
   - ID/Access tokens expire in ~1 hour by default
   - Refresh tokens last 30 days by default
   - Temp AWS credentials from Identity Pool expire in ~1 hour

---

## Learning Path

We recommend running the demos in this order:

1. **`trust`** — Read the trust policy comparison table first
2. **`iam`** — Create and assume a role, see temp credentials in action
3. **`userpool`** — Sign up, sign in, decode JWTs, understand token types
4. **`compare`** — Understand when you need User Pool vs Identity Pool
5. **`idpool`** — Exchange a JWT for AWS credentials
6. **`e2e`** — See all three pieces work together

---

## License

MIT — built for learning purposes.
