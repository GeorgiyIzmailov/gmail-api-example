const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");

require("dotenv").config();

const url = "https://api.inkeep.com/v0/chat_sessions/chat_results";

// function for get response from our AI
const getResponseFromAI = async (emailBody) => {
  const integrationId = process.env.INKEEP_INTEGRATION_ID;
  const apiKey = process.env.INKEEP_API_KEY;

  if (!apiKey || !integrationId) {
    console.error("not found api key or integration id");
  }

  const data = {
    integration_id: integrationId,
    chat_session: {
      messages: [
        {
          role: "user",
          content: "Why Inkeep?",
        },
      ],
    },
  };

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(data),
  };

  const response = await fetch(url, options);
  const responseFromAIMessage = await response.json();

  return responseFromAIMessage.message.content;
};

// If modifying these scopes, delete token.json.
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function startListener(auth) {
  // gmail api initialization
  const gmail = google.gmail({ version: "v1", auth });

  // track changes through the Pub/Sub service
  // const res = await gmail.users.watch({
  //   userId: "me",
  //   requestBody: {
  //     topicName: "projects/alert-rush-420508/topics/GmailMyTestTopic",
  //   },
  // });

  // list all emails:
  // const res = await gmail.users.messages.list({
  //   userId: "me",
  //   labelIds: ["INBOX"],
  // });
  // const messages = res.data.messages;
 
  // get email by id
  // const msg = await gmail.users.messages.get({
  //   userId: "me",
  //   id: "18f1a7dceabefae8",
  // });

  // get response from out AI 
  const responseFromAI = await getResponseFromAI();

  // test options for email
  const emailLines = [
    "From: georgiy-izmailov-v@inkeep.ai",
    "To: georgiy-izmailov-v@inkeep.com",
    "Content-type: text/html;charset=iso-8859-1",
    "MIME-Version: 1.0",
    "Subject: Test Subject",
    "",
    `${responseFromAI}`,
  ];

  const email = emailLines.join("\r\n").trim();
  const base64Email = Buffer.from(email).toString("base64");

  // send email
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: base64Email,
    },
  });
}

authorize().then(startListener).catch(console.error);
