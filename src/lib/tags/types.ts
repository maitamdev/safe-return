export type SafeTagStatus = "active" | "recovered" | "disabled";
export type SafeTagReportStatus = "unread" | "read" | "resolved";

export type SafeTagReport = {
  id: string;
  reporterName: string;
  contact: string;
  location: string;
  message: string;
  status: SafeTagReportStatus;
  createdAt: string;
};

export type SafeTag = {
  id: string;
  publicCode: string;
  label: string;
  publicNote: string;
  status: SafeTagStatus;
  ownerWallet: string;
  createdAt: string;
  reports: SafeTagReport[];
};

export type PublicSafeTag = Pick<SafeTag, "label" | "publicNote" | "status">;
