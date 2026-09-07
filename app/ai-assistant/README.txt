SaiNal One AI Agent — One Deployment Package

ADD NEW FILE
1. lib/ai/agentEngine.js
   Use: agentEngine.js

REPLACE FULL FILES
2. app/api/ai-assistant/route.js
   Use: route.js

3. app/ai-assistant/page.js
   Use: page.js

4. app/ai-assistant/ai-assistant.module.css
   Use: ai-assistant.module.css

NO OTHER FILES NEED TO CHANGE FOR THIS UPGRADE.
NO SUPABASE SQL IS REQUIRED.

This upgrade keeps your existing Lead/Quote/Proposal/Invoice/Conversion services and adds a central AI Agent planner/executor.

Supported AI operations:
- Create lead
- Update lead
- Convert lead -> Customer + Project
- Create quote
- Create proposal
- Update customer
- Update project / complete / cancel / reopen
- Create task
- Update / complete / cancel task
- Create follow-up
- Schedule call
- Schedule meeting
- Schedule demo
- Reschedule / complete / cancel activities
- Create invoice from quote
- Mark invoice paid
- Send CRM-linked email and log it
- Multi-step actions in one prompt
- Conversation follow-up context
- Email history in AI analysis
- Employee assignment when permitted

Confirmation is required before:
- Multi-step workflows
- Sending email
- Converting a lead
- Creating invoice from quote
- Marking invoice paid
- Reassigning records
- Completing/cancelling projects
- Cancelling tasks or activities

Hard deletes and destructive bulk changes deliberately remain manual.
