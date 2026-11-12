export type EmailLeg = "sent" | "failed" | "skipped";

export type EmailStatus = {
  client: EmailLeg;
  internal: EmailLeg;
  detail?: string;
};

export type ReviewResponse = {
  designation: string;
  rating: number;
  review: string;
  feedback: string;
  submittedAt: string;
  emailStatus: EmailStatus;
};

export type ReviewLink = {
  token: string;
  pocName: string;
  brandName: string;
  service: string;
  email: string;
  createdAt: string;
  status: "pending" | "submitted";
  response?: ReviewResponse;
};

export type InviteInput = {
  pocName: string;
  brandName: string;
  service: string;
  email: string;
};

export type ResponseInput = {
  designation: string;
  rating: number;
  review: string;
  feedback: string;
};

export type StoreFile = {
  version: 1;
  notifyEmails: string[];
  links: ReviewLink[];
};
