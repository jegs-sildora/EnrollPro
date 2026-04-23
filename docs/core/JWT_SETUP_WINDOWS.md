# JWT Secret Setup Guide (Windows)

This guide explains how to properly configure the `JWT_SECRET` environment variable required for the EnrollPro backend authentication system on a Windows development machine.

## Why is this needed?
The `JWT_SECRET` is a unique string used to sign and verify JSON Web Tokens. It ensures that the session cookies issued by EnrollPro cannot be forged by unauthorized users.

---

## Step 1: Generate a Secure Secret
You should never use a simple word like "secret" or "password". Generate a cryptographically secure random string using Node.js.

1. Open **PowerShell** or **Command Prompt**.
2. Run the following command:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
3. Copy the long hexadecimal string that appears in your terminal.

---

## Step 2: Configure the Server Environment
You need to add this secret to your local server configuration.

1. Navigate to the `server/` directory in the project root:
   ```powershell
   cd server
   ```
2. Check if a `.env` file exists. If not, create one by copying the example:
   ```powershell
   copy .env.example .env
   ```
3. Open the `.env` file in your preferred editor (VS Code, Notepad, etc.).
4. Find the line:
   ```env
   JWT_SECRET="change-this-to-a-random-32-char-minimum-secret-key"
   ```
5. Replace the placeholder text with the string you copied in Step 1:
   ```env
   JWT_SECRET="your_generated_hex_string_here"
   ```
6. Save the file.

---

## Step 3: Verify the Setup
1. Ensure the backend server is running. If it was already running, you **must restart it** for the new environment variables to take effect.
2. If you are using `pnpm`:
   ```powershell
   pnpm --filter server dev
   ```

---

## ⚠️ Security Warnings
- **Never commit your `.env` file to Git.** It is already ignored by `.gitignore`.
- **Never share your `JWT_SECRET`.** If someone gets this string, they can bypass all authentication in your system.
- **Production vs. Development:** Use a different secret for your production/live environment than the one you use for local development.

---

## Troubleshooting (Windows Specific)
- **File Extensions:** Ensure the file is named exactly `.env` and not `.env.txt`. In Windows File Explorer, enable "File name extensions" under the View tab to be sure.
- **Quotes:** While not strictly required for all characters, it is best practice to wrap the secret in double quotes (`"..."`) in the `.env` file to handle special characters correctly.