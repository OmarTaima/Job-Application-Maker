import { useState, useEffect } from "react";
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
import { applicantsService, ApiError } from "../../services/applicantsService";
import type { Applicant } from "../../services/applicantsService";
import { jobPositionsService } from "../../services/jobPositionsService";
import { companiesService } from "../../services/companiesService";
import { departmentsService } from "../../services/departmentsService";

const ApplicantData = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Modal states
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  // Data states
  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [jobTitle, setJobTitle] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [departmentName, setDepartmentName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [interviewForm, setInterviewForm] = useState({
    date: "",
    time: "",
    description: "",
    comment: "",
    location: "",
    link: "",
    type: "phone" as "phone" | "video" | "in-person",
  });
  const [messageForm, setMessageForm] = useState({
    subject: "",
    body: "",
    type: "email" as "email" | "sms" | "internal",
  });
  const [commentForm, setCommentForm] = useState({
    text: "",
  });
  const [statusForm, setStatusForm] = useState({
    status: "" as Applicant["status"] | "",
    notes: "",
  });

  useEffect(() => {
    if (id) {
      loadApplicantData(id);
    }
  }, [id]);

  const loadApplicantData = async (applicantId: string) => {
    try {
      setLoading(true);
      const data = await applicantsService.getApplicantById(applicantId);
      setApplicant(data);

      // Load related entities
      const [job, company, department] = await Promise.all([
        jobPositionsService
          .getJobPositionById(data.jobPositionId)
          .catch(() => ({ title: "Unknown Job" })),
        companiesService
          .getCompanyById(data.companyId)
          .catch(() => ({ name: "Unknown Company" })),
        departmentsService
          .getDepartmentById(data.departmentId)
          .catch(() => ({ name: "Unknown Department" })),
      ]);

      setJobTitle(job.title);
      setCompanyName(company.name);
      setDepartmentName(department.name);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Failed to load applicant data";
      setError(errorMessage);
      console.error("Error loading applicant:", err);
    } finally {
      setLoading(false);
    }
  };

  const statusOptions = [
    { value: "pending", label: "Pending" },
    { value: "screening", label: "Screening" },
    { value: "interview", label: "Interview" },
    { value: "offer", label: "Offer" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];

  const handleInterviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !applicant) return;

    try {
      const interviewData: any = {
        description: interviewForm.description,
        type: interviewForm.type,
      };

      if (interviewForm.comment) interviewData.comment = interviewForm.comment;
      if (interviewForm.date) interviewData.date = interviewForm.date;
      if (interviewForm.time) interviewData.time = interviewForm.time;
      if (interviewForm.location)
        interviewData.location = interviewForm.location;
      if (interviewForm.link) interviewData.link = interviewForm.link;

      await applicantsService.scheduleInterview(id, interviewData);
      await loadApplicantData(id);
      setInterviewForm({
        date: "",
        time: "",
        description: "",
        comment: "",
        location: "",
        link: "",
        type: "phone",
      });
      setShowInterviewModal(false);
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Failed to schedule interview";
      alert(errorMessage);
      console.error("Error scheduling interview:", err);
    }
  };

  const handleMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !applicant) return;

    try {
      const messageData = {
        subject: messageForm.subject,
        body: messageForm.body,
        type: messageForm.type,
      };

      await applicantsService.sendMessage(id, messageData);
      await loadApplicantData(id);
      setMessageForm({ subject: "", body: "", type: "email" });
      setShowMessageModal(false);
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Failed to send message";
      alert(errorMessage);
      console.error("Error sending message:", err);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !applicant) return;

    try {
      const commentData = {
        text: commentForm.text,
      };

      await applicantsService.addComment(id, commentData);
      await loadApplicantData(id);
      setCommentForm({ text: "" });
      setShowCommentModal(false);
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Failed to add comment";
      alert(errorMessage);
      console.error("Error adding comment:", err);
    }
  };

  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !applicant || !statusForm.status) return;

    try {
      const statusData = {
        status: statusForm.status,
        notes: statusForm.notes || undefined,
      };

      await applicantsService.updateApplicantStatus(id, statusData);
      await loadApplicantData(id);
      setStatusForm({ status: "", notes: "" });
      setShowStatusModal(false);
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Failed to update status";
      alert(errorMessage);
      console.error("Error updating status:", err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "screening":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "interview":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      case "offer":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "approved":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "rejected":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  if (loading) {
    return (
      <>
        <PageMeta
          title="Applicant Details - Loading"
          description="Loading applicant data"
        />
        <div className="p-12 text-center text-gray-500">
          Loading applicant data...
        </div>
      </>
    );
  }

  if (error || !applicant) {
    return (
      <>
        <PageMeta
          title="Applicant Details - Error"
          description="Error loading applicant"
        />
        <div className="p-12 text-center">
          <div className="mb-4 text-red-600 dark:text-red-400">
            {error || "Applicant not found"}
          </div>
          <button
            onClick={() => navigate("/recruiting/applicants")}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Applicants
          </button>
        </div>
      </>
    );
  }

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
        description={`${jobTitle} - ${companyName}`}
      />
      <PageBreadcrumb pageTitle={applicant.fullName} />

      <div className="grid gap-6">
        {/* Back Button and Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/recruiting/applicants")}
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
                <Label>Job Position</Label>
                <p className="mt-1 text-gray-900 dark:text-white">{jobTitle}</p>
              </div>
              <div>
                <Label>Company</Label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {companyName}
                </p>
              </div>
              <div>
                <Label>Department</Label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {departmentName}
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
        {applicant.customResponses &&
          Object.keys(applicant.customResponses).length > 0 && (
            <ComponentCard
              title="Application Responses"
              desc="Custom field responses"
            >
              <div className="grid grid-cols-2 gap-6">
                {Object.entries(applicant.customResponses).map(
                  ([key, value]) => (
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
                  )
                )}
              </div>
            </ComponentCard>
          )}

        {/* Status History */}
        <ComponentCard title="Status History" desc="Track status changes">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {applicant.statusHistory?.map((history, index) => (
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
            <Label htmlFor="interview-date">Interview Date</Label>
            <Input
              id="interview-date"
              type="date"
              value={interviewForm.date}
              onChange={(e) =>
                setInterviewForm({ ...interviewForm, date: e.target.value })
              }
            />
          </div>

          <div>
            <Label htmlFor="interview-time">Interview Time</Label>
            <Input
              id="interview-time"
              type="time"
              value={interviewForm.time}
              onChange={(e) =>
                setInterviewForm({ ...interviewForm, time: e.target.value })
              }
            />
          </div>

          <div>
            <Label htmlFor="interview-type">Interview Type</Label>
            <Select
              options={[
                { value: "phone", label: "Phone" },
                { value: "video", label: "Video" },
                { value: "in-person", label: "In-Person" },
              ]}
              placeholder="Select interview type"
              onChange={(value) =>
                setInterviewForm({
                  ...interviewForm,
                  type: value as "phone" | "video" | "in-person",
                })
              }
            />
          </div>

          <div>
            <Label htmlFor="interview-location">Location (Optional)</Label>
            <Input
              id="interview-location"
              type="text"
              value={interviewForm.location}
              onChange={(e) =>
                setInterviewForm({ ...interviewForm, location: e.target.value })
              }
              placeholder="Office address or meeting room"
            />
          </div>

          <div>
            <Label htmlFor="interview-link">Video Link (Optional)</Label>
            <Input
              id="interview-link"
              type="url"
              value={interviewForm.link}
              onChange={(e) =>
                setInterviewForm({ ...interviewForm, link: e.target.value })
              }
              placeholder="https://meet.example.com/..."
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
            <Label htmlFor="message-type">Message Type</Label>
            <Select
              options={[
                { value: "email", label: "Email" },
                { value: "sms", label: "SMS" },
                { value: "internal", label: "Internal Note" },
              ]}
              placeholder="Select message type"
              onChange={(value) =>
                setMessageForm({
                  ...messageForm,
                  type: value as "email" | "sms" | "internal",
                })
              }
            />
          </div>

          <div>
            <Label htmlFor="message-subject">Subject</Label>
            <Input
              id="message-subject"
              type="text"
              value={messageForm.subject}
              onChange={(e) =>
                setMessageForm({ ...messageForm, subject: e.target.value })
              }
              placeholder="Message subject"
            />
          </div>

          <div>
            <Label htmlFor="message-body">Message</Label>
            <TextArea
              value={messageForm.body}
              onChange={(value) =>
                setMessageForm({ ...messageForm, body: value })
              }
              placeholder="Enter your message to the applicant"
              rows={5}
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
              value={commentForm.text}
              onChange={(value) => setCommentForm({ text: value })}
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
                setStatusForm({
                  ...statusForm,
                  status: value as Applicant["status"],
                })
              }
            />
          </div>

          <div>
            <Label htmlFor="status-notes">Notes (Optional)</Label>
            <TextArea
              value={statusForm.notes}
              onChange={(value) =>
                setStatusForm({ ...statusForm, notes: value })
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
