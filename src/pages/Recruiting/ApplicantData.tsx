import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import TextArea from "../../components/form/input/TextArea";
import Select from "../../components/form/Select";
import { Modal } from "../../components/ui/modal";
import { PlusIcon } from "../../icons";

type Interview = {
  issuedBy: string;
  issuedAt: string;
  description: string;
  comment?: string;
};

type Message = {
  status: string;
  text: string;
  sentAt: string;
  sentBy: string;
  comment?: string;
};

type Comment = {
  changedBy: string;
  changedAt: string;
  comment: string;
};

type StatusHistory = {
  status: string;
  changedBy: string;
  changedAt: string;
  notes?: string;
};

type ApplicantData = {
  _id: string;
  companyId: string;
  jobPositionId: string;
  departmentId: string;
  status: "pending" | "approved" | "interview" | "rejected";
  submittedAt: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  profilePhoto?: string;
  cvFilePath?: string;
  customResponses: Record<string, any>;
  interviews: Interview[];
  messages: Message[];
  comments: Comment[];
  statusHistory: StatusHistory[];
};

const ApplicantData = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Use id for fetching data (placeholder)
  console.log("Applicant ID:", id);

  // Modal states
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  // Form states
  const [interviewForm, setInterviewForm] = useState({
    date: "",
    description: "",
    comment: "",
  });
  const [messageForm, setMessageForm] = useState({
    text: "",
    comment: "",
  });
  const [commentForm, setCommentForm] = useState({
    comment: "",
  });
  const [statusForm, setStatusForm] = useState({
    status: "",
    comment: "",
  });

  // Mock data - replace with API call
  const [applicant, setApplicant] = useState<ApplicantData>({
    _id: "APP001",
    companyId: "COMP-12345678",
    jobPositionId: "JOB001",
    departmentId: "DEPT-001",
    status: "pending",
    submittedAt: "2025-12-28T10:00:00Z",
    fullName: "John Doe",
    email: "john.doe@example.com",
    phone: "+1234567890",
    address: "123 Main St, New York, NY",
    profilePhoto:
      "https://ui-avatars.com/api/?name=John+Doe&size=200&background=3b82f6&color=fff",
    cvFilePath: "/uploads/cv/john-doe.pdf",
    customResponses: {
      years_experience: "5",
      education_level: "Bachelor's",
      skills: ["JavaScript", "React", "Node.js"],
    },
    interviews: [
      {
        issuedBy: "Admin",
        issuedAt: "2025-12-29T14:00:00Z",
        description: "Technical Interview",
        comment: "Candidate shows strong technical skills",
      },
    ],
    messages: [
      {
        status: "sent",
        text: "Thank you for your application. We will review it soon.",
        sentAt: "2025-12-28T11:00:00Z",
        sentBy: "HR Team",
      },
    ],
    comments: [
      {
        changedBy: "Admin",
        changedAt: "2025-12-28T15:00:00Z",
        comment: "Strong candidate, proceed to interview",
      },
    ],
    statusHistory: [
      {
        status: "pending",
        changedBy: "System",
        changedAt: "2025-12-28T10:00:00Z",
        notes: "Application submitted",
      },
    ],
  });

  const statusOptions = [
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "interview", label: "Interview" },
    { value: "rejected", label: "Rejected" },
  ];

  const handleInterviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newInterview: Interview = {
      issuedBy: "Current User", // Replace with actual user
      issuedAt: interviewForm.date,
      description: interviewForm.description,
      comment: interviewForm.comment || undefined,
    };
    const historyEntry: StatusHistory = {
      status: "Interview Scheduled",
      changedBy: "Current User",
      changedAt: new Date().toISOString(),
      notes: `Interview: ${interviewForm.description}${
        interviewForm.comment ? ` - ${interviewForm.comment}` : ""
      }`,
    };
    setApplicant((prev) => ({
      ...prev,
      interviews: [...prev.interviews, newInterview],
      statusHistory: [...prev.statusHistory, historyEntry],
    }));
    setInterviewForm({ date: "", description: "", comment: "" });
    setShowInterviewModal(false);
    console.log("Interview created:", newInterview);
  };

  const handleMessageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newMessage: Message = {
      status: "sent",
      text: messageForm.text,
      sentAt: new Date().toISOString(),
      sentBy: "Current User", // Replace with actual user
      comment: messageForm.comment || undefined,
    };
    const historyEntry: StatusHistory = {
      status: "Message Sent",
      changedBy: "Current User",
      changedAt: new Date().toISOString(),
      notes: `Message: ${messageForm.text.substring(0, 50)}${
        messageForm.text.length > 50 ? "..." : ""
      }${messageForm.comment ? ` - ${messageForm.comment}` : ""}`,
    };
    setApplicant((prev) => ({
      ...prev,
      messages: [...prev.messages, newMessage],
      statusHistory: [...prev.statusHistory, historyEntry],
    }));
    setMessageForm({ text: "", comment: "" });
    setShowMessageModal(false);
    console.log("Message sent:", newMessage);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newComment: Comment = {
      changedBy: "Current User", // Replace with actual user
      changedAt: new Date().toISOString(),
      comment: commentForm.comment,
    };
    const historyEntry: StatusHistory = {
      status: "Comment Added",
      changedBy: "Current User",
      changedAt: new Date().toISOString(),
      notes: commentForm.comment,
    };
    setApplicant((prev) => ({
      ...prev,
      comments: [...prev.comments, newComment],
      statusHistory: [...prev.statusHistory, historyEntry],
    }));
    setCommentForm({ comment: "" });
    setShowCommentModal(false);
    console.log("Comment added:", newComment);
  };

  const handleStatusChange = (e: React.FormEvent) => {
    e.preventDefault();
    const newStatus: StatusHistory = {
      status: statusForm.status,
      changedBy: "Current User", // Replace with actual user
      changedAt: new Date().toISOString(),
      notes: statusForm.comment || undefined,
    };
    setApplicant((prev) => ({
      ...prev,
      status: statusForm.status as any,
      statusHistory: [...prev.statusHistory, newStatus],
    }));
    setStatusForm({ status: "", comment: "" });
    setShowStatusModal(false);
    console.log("Status changed:", newStatus);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "approved":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "interview":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "rejected":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <PageMeta
        title={`Applicant - ${applicant.fullName}`}
        description="View applicant details"
      />
      <PageBreadcrumb pageTitle={applicant.fullName} />

      <div className="grid gap-6">
        {/* Back Button and Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/applicants")}
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            ← Back to Applicants
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => setShowInterviewModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <PlusIcon className="h-4 w-4" />
              Schedule Interview
            </button>
            <button
              onClick={() => setShowMessageModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
            >
              <PlusIcon className="h-4 w-4" />
              Send Message
            </button>
            <button
              onClick={() => setShowCommentModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            >
              <PlusIcon className="h-4 w-4" />
              Add Comment
            </button>
            <button
              onClick={() => setShowStatusModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              Change Status
            </button>
          </div>
        </div>

        {/* Personal Information */}
        <ComponentCard title="Personal Information" desc="Applicant details">
          <div className="flex gap-6">
            {/* Profile Photo */}
            {applicant.profilePhoto && (
              <div className="flex-shrink-0">
                <img
                  src={applicant.profilePhoto}
                  alt={applicant.fullName}
                  className="h-32 w-32 rounded-full object-cover ring-4 ring-gray-200 dark:ring-gray-700"
                />
              </div>
            )}

            <div className="grid flex-1 grid-cols-2 gap-6">
              <div>
                <Label>Full Name</Label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {applicant.fullName}
                </p>
              </div>
              <div>
                <Label>Email</Label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {applicant.email}
                </p>
              </div>
              <div>
                <Label>Phone</Label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {applicant.phone}
                </p>
              </div>
              <div>
                <Label>Address</Label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {applicant.address}
                </p>
              </div>
              <div>
                <Label>Status</Label>
                <span
                  className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(
                    applicant.status
                  )}`}
                >
                  {applicant.status.charAt(0).toUpperCase() +
                    applicant.status.slice(1)}
                </span>
              </div>
              <div>
                <Label>Submitted At</Label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {formatDate(applicant.submittedAt)}
                </p>
              </div>
              {applicant.cvFilePath && (
                <div>
                  <Label>CV / Resume</Label>
                  <a
                    href={applicant.cvFilePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-primary hover:text-primary/80"
                  >
                    Download CV
                  </a>
                </div>
              )}
            </div>
          </div>
        </ComponentCard>

        {/* Custom Responses */}
        {Object.keys(applicant.customResponses).length > 0 && (
          <ComponentCard
            title="Application Responses"
            desc="Custom field responses"
          >
            <div className="grid grid-cols-2 gap-6">
              {Object.entries(applicant.customResponses).map(([key, value]) => (
                <div key={key}>
                  <Label>
                    {key
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Label>
                  <p className="mt-1 text-gray-900 dark:text-white">
                    {Array.isArray(value) ? value.join(", ") : value}
                  </p>
                </div>
              ))}
            </div>
          </ComponentCard>
        )}

        {/* Status History */}
        <ComponentCard title="Status History" desc="Track status changes">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {applicant.statusHistory.map((history, index) => (
              <div
                key={index}
                onClick={() =>
                  setExpandedHistory(
                    expandedHistory === `${index}` ? null : `${index}`
                  )
                }
                className="cursor-pointer rounded-lg border border-stroke p-4 transition hover:bg-gray-50 dark:border-strokedark dark:hover:bg-gray-800/50"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(
                      history.status
                    )}`}
                  >
                    {history.status.charAt(0).toUpperCase() +
                      history.status.slice(1)}
                  </span>
                  <svg
                    className={`h-4 w-4 transition-transform ${
                      expandedHistory === `${index}` ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {formatDate(history.changedAt)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  By: {history.changedBy}
                </p>
                {expandedHistory === `${index}` && history.notes && (
                  <div className="mt-3 border-t border-stroke pt-3 dark:border-strokedark">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {history.notes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ComponentCard>
      </div>

      {/* Interview Modal */}
      <Modal
        isOpen={showInterviewModal}
        onClose={() => setShowInterviewModal(false)}
        className="max-w-2xl p-6"
      >
        <form onSubmit={handleInterviewSubmit} className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Schedule Interview
          </h2>

          <div>
            <Label htmlFor="interview-date">Interview Date & Time</Label>
            <Input
              id="interview-date"
              type="datetime-local"
              value={interviewForm.date}
              onChange={(e) =>
                setInterviewForm({ ...interviewForm, date: e.target.value })
              }
            />
          </div>

          <div>
            <Label htmlFor="interview-description">Description</Label>
            <TextArea
              value={interviewForm.description}
              onChange={(value) =>
                setInterviewForm({ ...interviewForm, description: value })
              }
              placeholder="e.g., Technical Interview, HR Round"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="interview-comment">Comment (Optional)</Label>
            <TextArea
              value={interviewForm.comment}
              onChange={(value) =>
                setInterviewForm({ ...interviewForm, comment: value })
              }
              placeholder="Add any notes about this interview"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowInterviewModal(false)}
              className="rounded-lg border border-stroke px-6 py-2 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
            >
              Schedule Interview
            </button>
          </div>
        </form>
      </Modal>

      {/* Message Modal */}
      <Modal
        isOpen={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        className="max-w-2xl p-6"
      >
        <form onSubmit={handleMessageSubmit} className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Send Message
          </h2>

          <div>
            <Label htmlFor="message-text">Message</Label>
            <TextArea
              value={messageForm.text}
              onChange={(value) =>
                setMessageForm({ ...messageForm, text: value })
              }
              placeholder="Enter your message to the applicant"
              rows={5}
            />
          </div>

          <div>
            <Label htmlFor="message-comment">Comment (Optional)</Label>
            <TextArea
              value={messageForm.comment}
              onChange={(value) =>
                setMessageForm({ ...messageForm, comment: value })
              }
              placeholder="Internal note about this message"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowMessageModal(false)}
              className="rounded-lg border border-stroke px-6 py-2 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-purple-600 px-6 py-2 text-white hover:bg-purple-700"
            >
              Send Message
            </button>
          </div>
        </form>
      </Modal>

      {/* Comment Modal */}
      <Modal
        isOpen={showCommentModal}
        onClose={() => setShowCommentModal(false)}
        className="max-w-2xl p-6"
      >
        <form onSubmit={handleCommentSubmit} className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Add Comment
          </h2>

          <div>
            <Label htmlFor="comment-text">Comment</Label>
            <TextArea
              value={commentForm.comment}
              onChange={(value) => setCommentForm({ comment: value })}
              placeholder="Enter your internal comment about this applicant"
              rows={5}
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowCommentModal(false)}
              className="rounded-lg border border-stroke px-6 py-2 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-gray-600 px-6 py-2 text-white hover:bg-gray-700"
            >
              Add Comment
            </button>
          </div>
        </form>
      </Modal>

      {/* Status Change Modal */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        className="max-w-2xl p-6"
      >
        <form onSubmit={handleStatusChange} className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Change Status
          </h2>

          <div>
            <Label htmlFor="status-select">New Status</Label>
            <Select
              options={statusOptions}
              placeholder="Select new status"
              onChange={(value) =>
                setStatusForm({ ...statusForm, status: value })
              }
            />
          </div>

          <div>
            <Label htmlFor="status-comment">Comment (Optional)</Label>
            <TextArea
              value={statusForm.comment}
              onChange={(value) =>
                setStatusForm({ ...statusForm, comment: value })
              }
              placeholder="Add notes about this status change"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowStatusModal(false)}
              className="rounded-lg border border-stroke px-6 py-2 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700"
            >
              Update Status
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default ApplicantData;
