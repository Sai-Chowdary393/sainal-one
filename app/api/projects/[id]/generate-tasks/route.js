import { NextResponse } from "next/server";
import { supabase } from "../../../../../lib/supabase";

const ORGANIZATION_ID =
  "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

const TASK_TEMPLATES = {
  website: [
    {
      task_name: "Kick-off Meeting",
      description:
        "Hold the initial project meeting and confirm objectives, stakeholders and communication arrangements.",
      dayOffset: 1,
    },
    {
      task_name: "Content Collection",
      description:
        "Collect branding, written content, images and other materials required for delivery.",
      dayOffset: 3,
    },
    {
      task_name: "Sitemap and Structure",
      description:
        "Confirm the required pages, navigation structure and customer journey.",
      dayOffset: 5,
    },
    {
      task_name: "Design",
      description:
        "Prepare and review the visual design and user experience.",
      dayOffset: 8,
    },
    {
      task_name: "Development",
      description:
        "Build the agreed website functionality and page templates.",
      dayOffset: 14,
    },
    {
      task_name: "Forms and Integrations",
      description:
        "Configure contact forms, enquiries and agreed third-party integrations.",
      dayOffset: 17,
    },
    {
      task_name: "Testing",
      description:
        "Test functionality, responsiveness, content and supported browsers.",
      dayOffset: 20,
    },
    {
      task_name: "Client Review",
      description:
        "Share the completed work with the client and collect final feedback.",
      dayOffset: 22,
    },
    {
      task_name: "SEO Setup",
      description:
        "Complete the agreed basic search-engine optimisation configuration.",
      dayOffset: 24,
    },
    {
      task_name: "Go Live",
      description:
        "Complete final checks and publish the approved website.",
      dayOffset: 28,
    },
  ],

  automation: [
    {
      task_name: "Kick-off Meeting",
      description:
        "Confirm business objectives, stakeholders, scope and communication arrangements.",
      dayOffset: 1,
    },
    {
      task_name: "Requirements Gathering",
      description:
        "Document the business requirements, users, systems and expected outcomes.",
      dayOffset: 3,
    },
    {
      task_name: "Current Process Review",
      description:
        "Review the existing process, pain points, manual work and dependencies.",
      dayOffset: 5,
    },
    {
      task_name: "Solution Design",
      description:
        "Design the proposed automated workflow, data flow and approvals.",
      dayOffset: 8,
    },
    {
      task_name: "Build and Configuration",
      description:
        "Configure and build the agreed automation solution.",
      dayOffset: 14,
    },
    {
      task_name: "Internal Testing",
      description:
        "Test the solution internally and resolve identified issues.",
      dayOffset:
