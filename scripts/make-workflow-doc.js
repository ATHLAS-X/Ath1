const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageBreak, TableOfContents,
} = require('docx');

const NODE_PATH = process.env.NODE_PATH || '';
// allow global docx require
require('module').globalPaths.push('C:/Users/saura/AppData/Roaming/npm/node_modules');

const border = { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" };
const borders = { top: border, bottom: border, left: border, right: border };

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    ...opts,
    children: [new TextRun({ text, ...(opts.run || {}) })],
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 220, after: 120 },
    children: [new TextRun({ text })],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 80 },
    children: [new TextRun({ text })],
  });
}

function step(text) {
  return new Paragraph({
    numbering: { reference: "steps", level: 0 },
    spacing: { after: 100 },
    children: [new TextRun({ text })],
  });
}

// Reusable screenshot placeholder — a bordered table with caption row.
function screenshotPlaceholder(caption) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [
      new TableRow({
        height: { value: 3600, rule: "atLeast" },
        children: [
          new TableCell({
            borders: {
              top: { style: BorderStyle.DASHED, size: 8, color: "808080" },
              bottom: { style: BorderStyle.DASHED, size: 8, color: "808080" },
              left: { style: BorderStyle.DASHED, size: 8, color: "808080" },
              right: { style: BorderStyle.DASHED, size: 8, color: "808080" },
            },
            width: { size: 9360, type: WidthType.DXA },
            shading: { fill: "F5F7FA", type: ShadingType.CLEAR },
            margins: { top: 200, bottom: 200, left: 200, right: 200 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 1400, after: 1400 },
                children: [new TextRun({
                  text: "[ Insert screenshot here ]",
                  italics: true, color: "808080", size: 22,
                })],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            borders,
            width: { size: 9360, type: WidthType.DXA },
            shading: { fill: "EEF2F6", type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 160, right: 160 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({
                  text: `Figure: ${caption}`,
                  italics: true, size: 20, color: "404040",
                })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function spacer() {
  return new Paragraph({ spacing: { after: 200 }, children: [new TextRun(" ")] });
}

const children = [];

// Title
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 120 },
  children: [new TextRun({ text: "SportX", bold: true, size: 56, color: "1F4E79" })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 80 },
  children: [new TextRun({ text: "User Workflow Documentation", bold: true, size: 32 })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 600 },
  children: [new TextRun({
    text: "A complete walkthrough of the SportX web application from first visit to ongoing use.",
    italics: true, color: "606060", size: 22,
  })],
}));

// Document Info Table
children.push(new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [3120, 6240],
  rows: [
    ["Product", "SportX — Player Profile & Video Showcase Platform"],
    ["Document", "User Workflow"],
    ["Audience", "Athletes / Players, Coaches, Scouts, Viewers"],
    ["Version", "1.0"],
  ].map(([k, v]) => new TableRow({
    children: [
      new TableCell({
        borders, width: { size: 3120, type: WidthType.DXA },
        shading: { fill: "1F4E79", type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 140, right: 140 },
        children: [new Paragraph({ children: [new TextRun({ text: k, bold: true, color: "FFFFFF" })] })],
      }),
      new TableCell({
        borders, width: { size: 6240, type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 140, right: 140 },
        children: [new Paragraph({ children: [new TextRun(v)] })],
      }),
    ],
  })),
}));
children.push(new Paragraph({ children: [new PageBreak()] }));

// Table of Contents
children.push(h1("Table of Contents"));
children.push(new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-3" }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 1. Overview
children.push(h1("1. Overview"));
children.push(p("SportX is a platform where athletes build a public player profile, showcase highlight videos from YouTube, and become discoverable to coaches and scouts. This document walks through the end-to-end user workflow — from landing on the site for the first time, to creating an account, completing a profile, uploading videos, and managing the profile over time."));
children.push(h2("1.1 Primary User Roles"));
children.push(bullet("Player — creates a profile, uploads videos, manages their showcase."));
children.push(bullet("Viewer (Coach / Scout / Fan) — browses public player profiles and watches videos."));
children.push(h2("1.2 Key Sections of the App"));
children.push(bullet("Landing Page (/) — public marketing entry."));
children.push(bullet("Authentication (/auth/login, /auth/signup) — account creation and sign-in."));
children.push(bullet("Profile Setup (/profile/setup) — first-time onboarding form."));
children.push(bullet("Dashboard (/dashboard) — logged-in home with quick actions."));
children.push(bullet("My Videos (/videos) — manage uploaded highlight videos."));
children.push(bullet("Upload Video (/videos/upload) — add a new YouTube highlight."));
children.push(bullet("Public Profile (/profile/[userId]) — what viewers see."));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 2. Landing
children.push(h1("2. Landing Page"));
children.push(p("The journey begins at the SportX landing page, which introduces the product and prompts the visitor to sign up or log in."));
children.push(h3("Actions available"));
children.push(bullet("Click Sign Up to create a new account."));
children.push(bullet("Click Log In to access an existing account."));
children.push(bullet("Explore featured players (if shown)."));
children.push(h3("Screenshot"));
children.push(screenshotPlaceholder("SportX landing page (/)"));
children.push(spacer());
children.push(new Paragraph({ children: [new PageBreak()] }));

// 3. Sign Up
children.push(h1("3. Account Creation"));
children.push(p("New users create an account by providing their basic credentials. SportX uses NextAuth for session management and bcrypt-hashed passwords for secure storage."));
children.push(h2("3.1 Sign Up Flow"));
children.push(step("Navigate to /auth/signup."));
children.push(step("Enter full name, email address, and a password."));
children.push(step("Submit the form. The server creates a new user record and starts a session."));
children.push(step("The user is redirected to /profile/setup to complete onboarding."));
children.push(h3("Screenshot"));
children.push(screenshotPlaceholder("Sign-up screen (/auth/signup)"));
children.push(spacer());
children.push(h2("3.2 Log In Flow"));
children.push(step("Returning users navigate to /auth/login."));
children.push(step("Enter email and password and submit."));
children.push(step("On success the user lands on /dashboard."));
children.push(h3("Screenshot"));
children.push(screenshotPlaceholder("Login screen (/auth/login)"));
children.push(spacer());
children.push(new Paragraph({ children: [new PageBreak()] }));

// 4. Profile Setup
children.push(h1("4. Profile Setup (First-Time Onboarding)"));
children.push(p("Immediately after signup, the user fills in their player details. This information powers their public profile and discoverability."));
children.push(h2("4.1 Fields Captured"));
children.push(bullet("Sport / Primary discipline"));
children.push(bullet("Position / Role"));
children.push(bullet("Date of birth, height, weight"));
children.push(bullet("Current club / academy"));
children.push(bullet("City and country"));
children.push(bullet("Short bio"));
children.push(bullet("Profile picture (optional)"));
children.push(h2("4.2 Steps"));
children.push(step("Fill out the multi-section form on /profile/setup."));
children.push(step("Validate inputs (required fields, formats)."));
children.push(step("Submit — the profile is saved to the database."));
children.push(step("User is redirected to /dashboard."));
children.push(h3("Screenshot"));
children.push(screenshotPlaceholder("Profile setup form (/profile/setup)"));
children.push(spacer());
children.push(new Paragraph({ children: [new PageBreak()] }));

// 5. Dashboard
children.push(h1("5. Dashboard"));
children.push(p("The dashboard is the logged-in home base. It surfaces the user's profile completeness, video count, and shortcuts to common actions."));
children.push(h2("5.1 What the User Can Do Here"));
children.push(bullet("View profile completion status."));
children.push(bullet("Jump to My Videos to manage highlights."));
children.push(bullet("Jump to Upload New Video."));
children.push(bullet("Open public profile preview."));
children.push(bullet("Edit profile details."));
children.push(bullet("Sign out."));
children.push(h3("Screenshot"));
children.push(screenshotPlaceholder("Dashboard (/dashboard)"));
children.push(spacer());
children.push(new Paragraph({ children: [new PageBreak()] }));

// 6. Videos
children.push(h1("6. My Videos — Managing Highlights"));
children.push(p("Players upload highlight reels by linking YouTube videos. The platform extracts metadata (thumbnail, title, ID) from the YouTube URL and stores it against the user's account."));
children.push(h2("6.1 Viewing My Videos"));
children.push(step("Navigate to /videos from the dashboard or top nav."));
children.push(step("The list of all uploaded videos is shown as cards (thumbnail, title, category)."));
children.push(step("Use Upload New Video to add another, or the delete control on a card to remove one."));
children.push(h3("Screenshot"));
children.push(screenshotPlaceholder("My Videos page (/videos)"));
children.push(spacer());
children.push(h2("6.2 Uploading a New Video"));
children.push(step("Click Upload New Video to open /videos/upload."));
children.push(step("Paste a YouTube URL (full link or short link)."));
children.push(step("Give the video a title."));
children.push(step("Choose a category (e.g., Match Highlight, Training, Skills)."));
children.push(step("Submit — the platform parses the YouTube ID, fetches metadata, and saves the record."));
children.push(step("On success the user is returned to /videos and the new card appears."));
children.push(h3("Screenshot"));
children.push(screenshotPlaceholder("Upload Video form (/videos/upload)"));
children.push(spacer());
children.push(h2("6.3 Deleting a Video"));
children.push(step("Open /videos."));
children.push(step("Click the delete control on the target video card."));
children.push(step("Confirm the prompt. The card is removed and the record is deleted from the database."));
children.push(h3("Screenshot"));
children.push(screenshotPlaceholder("Delete confirmation on a video card"));
children.push(spacer());
children.push(new Paragraph({ children: [new PageBreak()] }));

// 7. Public Profile
children.push(h1("7. Public Player Profile"));
children.push(p("Every player has a public, shareable profile page at /profile/[userId]. This is what coaches, scouts, and fans see."));
children.push(h2("7.1 What Viewers See"));
children.push(bullet("Hero section with player name, photo, sport, and position."));
children.push(bullet("Stats / attributes (age, club, location, etc.)."));
children.push(bullet("Bio."));
children.push(bullet("Embedded highlight videos."));
children.push(bullet("Share link button."));
children.push(h2("7.2 Sharing the Profile"));
children.push(step("From the dashboard or top nav, copy the public profile URL."));
children.push(step("Share with coaches/scouts via WhatsApp, email, or social media."));
children.push(step("Viewers open the link — no login required."));
children.push(h3("Screenshot"));
children.push(screenshotPlaceholder("Public player profile (/profile/[userId])"));
children.push(spacer());
children.push(new Paragraph({ children: [new PageBreak()] }));

// 8. Edit Profile
children.push(h1("8. Editing Profile Details"));
children.push(p("Players can return to their profile setup screen at any time to update their details — for instance after changing clubs, recording new measurements, or updating their bio."));
children.push(step("Click Edit Profile from the dashboard."));
children.push(step("Update any field on the form."));
children.push(step("Submit. The changes appear immediately on the public profile."));
children.push(h3("Screenshot"));
children.push(screenshotPlaceholder("Edit profile screen"));
children.push(spacer());
children.push(new Paragraph({ children: [new PageBreak()] }));

// 9. Sign Out
children.push(h1("9. Sign Out"));
children.push(p("Sessions are managed by NextAuth. Signing out ends the session and returns the user to the landing page."));
children.push(step("Click Sign Out from the dashboard or top nav menu."));
children.push(step("The user is redirected to / (landing page)."));
children.push(h3("Screenshot"));
children.push(screenshotPlaceholder("Sign-out action / confirmation"));
children.push(spacer());
children.push(new Paragraph({ children: [new PageBreak()] }));

// 10. End-to-End Summary
children.push(h1("10. End-to-End Workflow Summary"));
children.push(p("The complete happy-path journey for a new player:"));
children.push(step("Visit landing page."));
children.push(step("Sign up with email + password."));
children.push(step("Complete profile setup."));
children.push(step("Land on dashboard."));
children.push(step("Upload first highlight video via /videos/upload."));
children.push(step("Verify the video appears on /videos and on the public profile."));
children.push(step("Copy public profile link and share with coaches/scouts."));
children.push(step("Return later to upload more videos or edit profile."));

children.push(h2("10.1 Workflow at a Glance"));
const flowTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [780, 2400, 6180],
  rows: [
    ["#", "Stage", "Outcome"],
    ["1", "Landing", "User decides to sign up."],
    ["2", "Sign Up", "Account created, session started."],
    ["3", "Profile Setup", "Player attributes captured."],
    ["4", "Dashboard", "User sees their hub and next actions."],
    ["5", "Upload Video", "YouTube highlight linked to profile."],
    ["6", "My Videos", "Player manages their reel."],
    ["7", "Public Profile", "Shareable showcase live."],
    ["8", "Share & Iterate", "Profile shared; more videos added over time."],
  ].map((row, i) => new TableRow({
    tableHeader: i === 0,
    children: row.map((cell, j) => new TableCell({
      borders,
      width: { size: [780, 2400, 6180][j], type: WidthType.DXA },
      shading: i === 0
        ? { fill: "1F4E79", type: ShadingType.CLEAR }
        : { fill: i % 2 === 0 ? "F5F7FA" : "FFFFFF", type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 140, right: 140 },
      children: [new Paragraph({
        children: [new TextRun({
          text: cell,
          bold: i === 0,
          color: i === 0 ? "FFFFFF" : "000000",
        })],
      })],
    })),
  })),
});
children.push(flowTable);
children.push(spacer());

children.push(h1("11. Notes for Reviewers"));
children.push(bullet("Each screenshot placeholder above is a dashed-border block sized to roughly match a typical browser screenshot. Replace the placeholder text by selecting the block and inserting your screenshot in its place."));
children.push(bullet("Captions sit directly under each placeholder — edit them as needed."));
children.push(bullet("Headings use the built-in Heading 1/2/3 styles, so the Table of Contents will auto-update when you right-click it and choose Update Field in Word."));

// Build doc
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Calibri", size: 22 } } },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, color: "1F4E79", font: "Calibri" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, color: "2E75B6", font: "Calibri" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, color: "404040", font: "Calibri" },
        paragraph: { spacing: { before: 220, after: 120 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
        ],
      },
      {
        reference: "steps",
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        ],
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.resolve(process.argv[2] || "SportX_User_Workflow.docx");
  fs.writeFileSync(out, buf);
  console.log("Wrote", out);
});
