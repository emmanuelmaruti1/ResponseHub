
import { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import StaffManagement from "./StaffManagement";

import "./OrganizationDashboard.css";



const API_URL = "http://localhost:5000/api";



function Organization() {

  const navigate = useNavigate();



  const [organization, setOrganization] = useState(null);

  const [reports, setReports] = useState([]);

  const [departments, setDepartments] = useState([]);

  const [staff, setStaff] = useState([]);



  const [activeSection, setActiveSection] = useState("dashboard");

  const [selectedReport, setSelectedReport] = useState(null);



  const [searchTerm, setSearchTerm] = useState("");

  const [statusFilter, setStatusFilter] = useState("All");

  const [priorityFilter, setPriorityFilter] = useState("All");



  const [newDepartment, setNewDepartment] = useState("");

  const [editingDepartmentId, setEditingDepartmentId] = useState(null);

  const [editingDepartmentName, setEditingDepartmentName] = useState("");



  const [responseText, setResponseText] = useState("");



  const [loadingReports, setLoadingReports] = useState(false);

  const [loadingCase, setLoadingCase] = useState(false);

  const [savingCase, setSavingCase] = useState(false);

  const [evidencePreview, setEvidencePreview] = useState(null);



  const [selectedStaffId, setSelectedStaffId] = useState("");

  const [assigningCase, setAssigningCase] = useState(false);



  const getToken = () => localStorage.getItem("responsehub_token");



  const getAuthHeaders = () => ({

    "Content-Type": "application/json",

    Authorization: `Bearer ${getToken()}`,

  });



  const handleAuthenticationFailure = () => {

    localStorage.removeItem("responsehub_token");

    localStorage.removeItem("responsehub_organization");

    localStorage.removeItem("responsehub_logged_in");

    navigate("/organization-login");

  };



  useEffect(() => {

    const storedOrganization = localStorage.getItem(

      "responsehub_organization"

    );

    const token = getToken();



    if (!storedOrganization || !token) {

      navigate("/organization-login");

      return;

    }



    try {

      const parsedOrganization = JSON.parse(storedOrganization);



      if (!parsedOrganization?.id) {

        navigate("/organization-login");

        return;

      }



      setOrganization(parsedOrganization);

    } catch (error) {

      console.error("Failed to read organization:", error);

      navigate("/organization-login");

    }

  }, [navigate]);



  const normalizeEvidence = (file) => ({

    ...file,

    id: file.id ?? file.evidence_id ?? null,

    fileName:

      file.fileName ||

      file.file_name ||

      file.name ||

      "Evidence file",

    fileType:

      file.fileType ||

      file.file_type ||

      file.type ||

      "",

    fileSize:

      file.fileSize ??

      file.file_size ??

      file.size ??

      null,

    dataUrl:

      file.dataUrl ||

      file.data_url ||

      file.url ||

      file.fileUrl ||

      file.file_url ||

      file.path ||

      "",

    uploadedAt:

      file.uploadedAt ||

      file.uploaded_at ||

      null,

  });



  const normalizeReport = (report) => {

    const evidence = Array.isArray(report.evidence)

      ? report.evidence.map(normalizeEvidence)

      : [];



    return {

      ...report,



      id: report.id,



      caseId:

        report.caseId ||

        report.case_id ||

        report.caseNumber ||

        report.case_number ||

        "",



      organizationId:

        report.organizationId ??

        report.organization_id ??

        null,



      category: report.category || "Other",

      location: report.location || "",

      description: report.description || "",



      fullName:

        report.fullName ||

        report.full_name ||

        "",



      phone: report.phone || "",

      email: report.email || "",

      anonymous: Boolean(report.anonymous),



      priority: report.priority || "Medium",

      status: report.status || "Received",



      organizationResponse:

        report.organizationResponse ||

        report.organization_response ||

        "",



      responseAt:

        report.responseAt ||

        report.response_at ||

        null,



      submittedAt:

        report.submittedAt ||

        report.submitted_at ||

        null,



      updatedAt:

        report.updatedAt ||

        report.updated_at ||

        null,



      assignedStaffId:

        report.assignedStaffId ??

        report.assigned_staff_id ??

        null,



      assignedStaffName:

        report.assignedStaffName ||

        report.assigned_staff_name ||

        "",



      departmentId:

        report.departmentId ??

        report.department_id ??

        null,



      departmentName:

        report.departmentName ||

        report.department_name ||

        "",



      evidence,



      assignmentHistory:

        Array.isArray(report.assignmentHistory)

          ? report.assignmentHistory

          : Array.isArray(report.assignment_history)

          ? report.assignment_history

          : [],



      activity:

        Array.isArray(report.activity)

          ? report.activity

          : [],

    };

  };



  const loadReports = async () => {

    if (!organization?.id) return;



    setLoadingReports(true);



    try {

      const response = await fetch(

        `${API_URL}/organizations/${organization.id}/reports`,

        {

          headers: getAuthHeaders(),

          cache: "no-store",

        }

      );



      if (response.status === 401) {

        handleAuthenticationFailure();

        return;

      }



      if (!response.ok) {

        throw new Error("Failed to load organization reports.");

      }



      const data = await response.json();



      const reportList = Array.isArray(data)

        ? data

        : Array.isArray(data.reports)

        ? data.reports

        : Array.isArray(data.data)

        ? data.data

        : [];



      const normalizedReports = reportList

        .map(normalizeReport)

        .sort((a, b) => {

          const dateA = new Date(a.submittedAt || 0).getTime();

          const dateB = new Date(b.submittedAt || 0).getTime();

          return dateB - dateA;

        });



      setReports(normalizedReports);

      setSelectedReport((current) => {

        if (!current) return current;



        const updated = normalizedReports.find(

          (item) => item.caseId === current.caseId

        );



        if (!updated) return current;



        return {

          ...current,

          ...updated,

          evidence:

            current.evidence?.length

              ? current.evidence

              : updated.evidence,

          activity:

            current.activity?.length

              ? current.activity

              : updated.activity,

        };

      });

    } catch (error) {

      console.error("Failed to load reports:", error);

      alert(`Could not load reports: ${error.message}`);

    } finally {

      setLoadingReports(false);

    }

  };



  const loadStaff = async () => {

    if (!organization?.id) return;



    try {

      const response = await fetch(

        `${API_URL}/organizations/staff`,

        {

          headers: getAuthHeaders(),

          cache: "no-store",

        }

      );



      if (response.status === 401) {

        handleAuthenticationFailure();

        return;

      }



      if (!response.ok) {

        throw new Error("Failed to load organization staff.");

      }



      const data = await response.json();



      const staffList = Array.isArray(data)

        ? data

        : Array.isArray(data.staff)

        ? data.staff

        : Array.isArray(data.data)

        ? data.data

        : [];



      const normalizedStaff = staffList.map((member) => {

        const rawStatus = member.status;

        const normalizedStatus =

          typeof rawStatus === "string"

            ? rawStatus.toLowerCase()

            : "";



        const isActive =

          member.is_active === true ||

          member.isActive === true ||

          normalizedStatus === "active";



        return {

          ...member,

          id: member.id,



          staffId:

            member.staff_id ||

            member.staffId ||

            "",



          fullName:

            member.full_name ||

            member.fullName ||

            member.name ||

            "",



          email: member.email || "",

          phone: member.phone || "",

          role: member.role || "",

          duty: member.duty || "",



          organizationId:

            member.organization_id ??

            member.organizationId ??

            null,



          departmentId:

            member.department_id ??

            member.departmentId ??

            null,



          departmentName:

            member.department_name ||

            member.departmentName ||

            "",



          status: normalizedStatus,

          isActive,

        };

      });



      setStaff(normalizedStaff);

    } catch (error) {

      console.error("Failed to load staff:", error);

      setStaff([]);

    }

  };



  const loadDepartments = async () => {

    if (!organization?.id) return;



    try {

      const response = await fetch(

        `${API_URL}/organizations/${organization.id}/departments`,

        {

          headers: getAuthHeaders(),

          cache: "no-store",

        }

      );



      if (response.status === 401) {

        handleAuthenticationFailure();

        return;

      }



      if (!response.ok) {

        throw new Error("Failed to load departments.");

      }



      const data = await response.json();



      const departmentList = Array.isArray(data)

        ? data

        : Array.isArray(data.departments)

        ? data.departments

        : Array.isArray(data.data)

        ? data.data

        : [];



      setDepartments(departmentList);

    } catch (error) {

      console.error("Failed to load departments:", error);

      setDepartments([]);

    }

  };



  useEffect(() => {

    if (!organization?.id) return;



    loadReports();

    loadStaff();

    loadDepartments();

  }, [organization]);



  const loadCaseDetails = async (report) => {

    if (!organization?.id || !report?.caseId) return;



    setLoadingCase(true);



    try {

      const caseResponse = await fetch(

        `${API_URL}/organizations/${organization.id}/cases/${encodeURIComponent(

          report.caseId

        )}`,

        {

          headers: getAuthHeaders(),

          cache: "no-store",

        }

      );



      if (caseResponse.status === 401) {

        handleAuthenticationFailure();

        return;

      }



      if (!caseResponse.ok) {

        const errorData = await caseResponse.json().catch(() => ({}));

        throw new Error(

          errorData.message || "Failed to load case details."

        );

      }



      const caseData = await caseResponse.json();

      const rawCase =

        caseData?.case ||

        caseData?.report ||

        caseData;

      let evidence = Array.isArray(rawCase?.evidence)

        ? rawCase.evidence

        : Array.isArray(report.evidence)

        ? report.evidence

        : [];

      try {

        const evidenceResponse = await fetch(

          `${API_URL}/reports/${encodeURIComponent(report.caseId)}`,

          {

            headers: getAuthHeaders(),

            cache: "no-store",

          }

        );



        if (evidenceResponse.status === 401) {

          handleAuthenticationFailure();

          return;

        }



        if (evidenceResponse.ok) {

          const evidenceData = await evidenceResponse.json();



          const fetchedEvidence =

            Array.isArray(evidenceData?.report?.evidence)

              ? evidenceData.report.evidence

              : Array.isArray(evidenceData?.evidence)

              ? evidenceData.evidence

              : Array.isArray(evidenceData)

              ? evidenceData

              : null;

          if (fetchedEvidence !== null) {

            evidence = fetchedEvidence;

          }

        }

      } catch (error) {

        console.error("Failed to load evidence:", error);

      }



      let activity = Array.isArray(rawCase?.activity)

        ? rawCase.activity

        : [];



      try {

        const activityResponse = await fetch(

          `${API_URL}/reports/${encodeURIComponent(

            report.caseId

          )}/activity`,

          {

            headers: getAuthHeaders(),

            cache: "no-store",

          }

        );



        if (activityResponse.ok) {

          const activityData = await activityResponse.json();



          if (Array.isArray(activityData?.activity)) {

            activity = activityData.activity;

          } else if (Array.isArray(activityData)) {

            activity = activityData;

          }

        }

      } catch (error) {

        console.error("Failed to load case activity:", error);

      }



      const detailedReport = normalizeReport({

        ...report,

        ...rawCase,

        evidence,

        activity,

        assignmentHistory:

          rawCase?.assignmentHistory ||

          rawCase?.assignment_history ||

          report.assignmentHistory ||

          [],

      });



      setSelectedReport(detailedReport);



      setSelectedStaffId(

        detailedReport.assignedStaffId

          ? String(detailedReport.assignedStaffId)

          : ""

      );



      setResponseText(detailedReport.organizationResponse || "");

    } catch (error) {

      console.error("Failed to load case details:", error);

      alert(error.message);

    } finally {

      setLoadingCase(false);

    }

  };



  const handleOpenReport = async (report) => {

    setSelectedReport(report);

    setSelectedStaffId(

      report.assignedStaffId

        ? String(report.assignedStaffId)

        : ""

    );

    setResponseText(report.organizationResponse || "");



    await loadCaseDetails(report);

  };



  const updateStatus = async (newStatus) => {

    if (!organization?.id || !selectedReport?.caseId) return;



    const previousStatus = selectedReport.status;

    setSelectedReport((previous) =>

      previous ? { ...previous, status: newStatus } : previous

    );

    setSavingCase(true);



    try {

      const response = await fetch(

        `${API_URL}/organizations/${organization.id}/cases/${encodeURIComponent(

          selectedReport.caseId

        )}/status`,

        {

          method: "PUT",

          headers: getAuthHeaders(),

          body: JSON.stringify({ status: newStatus }),

        }

      );



      if (response.status === 401) {

        handleAuthenticationFailure();

        return;

      }



      const data = await response.json().catch(() => ({}));



      if (!response.ok) {

        throw new Error(data.message || "Failed to update case status.");

      }



      const savedStatus = data?.case?.status || newStatus;



      setSelectedReport((previous) =>

        previous

          ? {

              ...previous,

              status: savedStatus,

              updatedAt:

                data?.case?.updated_at ||

                data?.case?.updatedAt ||

                new Date().toISOString(),

            }

          : previous

      );



      setReports((previous) =>

        previous.map((item) =>

          item.caseId === selectedReport.caseId

            ? {

                ...item,

                status: savedStatus,

                updatedAt:

                  data?.case?.updated_at ||

                  data?.case?.updatedAt ||

                  new Date().toISOString(),

              }

            : item

        )

      );



      await loadReports();

    } catch (error) {

      setSelectedReport((previous) =>

        previous ? { ...previous, status: previousStatus } : previous

      );

      console.error("Failed to update status:", error);

      alert(error.message);

    } finally {

      setSavingCase(false);

    }

  };



  const updatePriority = async (newPriority) => {

    if (!organization?.id || !selectedReport?.caseId) return;



    const previousPriority = selectedReport.priority;



    setSelectedReport((previous) =>

      previous ? { ...previous, priority: newPriority } : previous

    );

    setSavingCase(true);



    try {

      const response = await fetch(

        `${API_URL}/organizations/${organization.id}/cases/${encodeURIComponent(

          selectedReport.caseId

        )}/priority`,

        {

          method: "PUT",

          headers: getAuthHeaders(),

          body: JSON.stringify({ priority: newPriority }),

        }

      );



      if (response.status === 401) {

        handleAuthenticationFailure();

        return;

      }



      const data = await response.json().catch(() => ({}));



      if (!response.ok) {

        throw new Error(data.message || "Failed to update case priority.");

      }



      const savedPriority = data?.case?.priority || newPriority;



      setSelectedReport((previous) =>

        previous

          ? {

              ...previous,

              priority: savedPriority,

              updatedAt:

                data?.case?.updated_at ||

                data?.case?.updatedAt ||

                new Date().toISOString(),

            }

          : previous

      );



      setReports((previous) =>

        previous.map((item) =>

          item.caseId === selectedReport.caseId

            ? {

                ...item,

                priority: savedPriority,

                updatedAt:

                  data?.case?.updated_at ||

                  data?.case?.updatedAt ||

                  new Date().toISOString(),

              }

            : item

        )

      );



      await loadReports();

    } catch (error) {

      setSelectedReport((previous) =>

        previous

          ? { ...previous, priority: previousPriority }

          : previous

      );

      console.error("Failed to update priority:", error);

      alert(error.message);

    } finally {

      setSavingCase(false);

    }

  };



  const saveResponse = async () => {

    if (!organization?.id || !selectedReport?.caseId) return;



    if (!responseText.trim()) {

      alert("Please enter a response before sending.");

      return;

    }



    setSavingCase(true);



    try {

      const response = await fetch(

        `${API_URL}/organizations/${organization.id}/cases/${encodeURIComponent(

          selectedReport.caseId

        )}/response`,

        {

          method: "PUT",

          headers: getAuthHeaders(),

          body: JSON.stringify({ response: responseText.trim() }),

        }

      );



      if (response.status === 401) {

        handleAuthenticationFailure();

        return;

      }



      const data = await response.json().catch(() => ({}));



      if (!response.ok) {

        throw new Error(

          data.message || "Failed to save organization response."

        );

      }



      const savedCase = data?.case || {};



      setSelectedReport((previous) =>

        previous

          ? {

              ...previous,

              organizationResponse:

                savedCase.organization_response ||

                savedCase.organizationResponse ||

                responseText.trim(),

              responseAt:

                savedCase.response_at ||

                savedCase.responseAt ||

                new Date().toISOString(),

            }

          : previous

      );



      await loadReports();

      alert("Response sent successfully.");

    } catch (error) {

      console.error("Failed to save response:", error);

      alert(error.message);

    } finally {

      setSavingCase(false);

    }

  };



  const assignDepartment = async (departmentId) => {

    if (!organization?.id || !selectedReport?.caseId) return;



    const numericDepartmentId = Number(departmentId);



    if (!Number.isInteger(numericDepartmentId) || numericDepartmentId <= 0) {

      alert("Please select a valid department.");

      return;

    }



    const selectedDepartment = departments.find(

      (department) => Number(department.id) === numericDepartmentId

    );



    if (!selectedDepartment) {

      alert("The selected department is not valid for this organization.");

      return;

    }



    setSavingCase(true);



    try {

      const response = await fetch(

        `${API_URL}/organizations/${organization.id}/cases/${encodeURIComponent(

          selectedReport.caseId

        )}/department`,

        {

          method: "PUT",

          headers: getAuthHeaders(),

          body: JSON.stringify({

            departmentId: numericDepartmentId,

          }),

        }

      );



      if (response.status === 401) {

        handleAuthenticationFailure();

        return;

      }



      const data = await response.json().catch(() => ({}));



      if (!response.ok) {

        throw new Error(data.message || "Failed to assign department.");

      }



      setSelectedStaffId("");



      const updatedReport = {

        ...selectedReport,

        departmentId: numericDepartmentId,

        departmentName: selectedDepartment.name,

        assignedStaffId: null,

        assignedStaffName: "",

      };



      setSelectedReport(updatedReport);

      await loadReports();

      await loadCaseDetails(updatedReport);

    } catch (error) {

      console.error("Failed to assign department:", error);

      alert(error.message);

    } finally {

      setSavingCase(false);

    }

  };



  const assignStaff = async () => {

    if (!organization?.id || !selectedReport?.caseId) return;



    if (!selectedStaffId) {

      alert("Please select a staff member.");

      return;

    }



    const departmentId = Number(

      selectedReport.departmentId ?? selectedReport.department_id

    );



    if (!Number.isInteger(departmentId) || departmentId <= 0) {

      alert("Please select a department first.");

      return;

    }



    const selectedStaff = staff.find(

      (member) => Number(member.id) === Number(selectedStaffId)

    );



    if (!selectedStaff) {

      alert("The selected staff member could not be found.");

      return;

    }



    const staffDepartmentId = Number(

      selectedStaff.departmentId ?? selectedStaff.department_id

    );



    const status = String(selectedStaff.status || "").toLowerCase();



    const active =

      status === "active" ||

      selectedStaff.isActive === true ||

      selectedStaff.is_active === true;



    if (staffDepartmentId !== departmentId) {

      alert("This staff member does not belong to the selected department.");

      return;

    }



    if (!active) {

      alert("This staff member is inactive.");

      return;

    }



    setAssigningCase(true);



    try {

      const response = await fetch(

        `${API_URL}/organizations/staff/assign-case`,

        {

          method: "POST",

          headers: getAuthHeaders(),

          body: JSON.stringify({

            caseId: selectedReport.caseId,

            staffId: Number(selectedStaffId),

          }),

        }

      );



      if (response.status === 401) {

        handleAuthenticationFailure();

        return;

      }



      const data = await response.json().catch(() => ({}));



      if (!response.ok) {

        throw new Error(data.message || "Failed to assign staff member.");

      }



      const staffName =

        selectedStaff.fullName ||

        selectedStaff.full_name ||

        selectedStaff.name ||

        selectedStaff.staffId ||

        selectedStaff.staff_id ||

        "Staff Member";



      const updatedReport = {

        ...selectedReport,

        assignedStaffId: Number(selectedStaffId),

        assignedStaffName: staffName,

      };



      setSelectedReport(updatedReport);

      await loadReports();

      await loadCaseDetails(updatedReport);



      alert("Case assigned successfully.");

    } catch (error) {

      console.error("Failed to assign staff:", error);

      alert(error.message);

    } finally {

      setAssigningCase(false);

    }

  };



  const addDepartment = async () => {

    const departmentName = newDepartment.trim();



    if (!organization?.id) return;



    if (!departmentName) {

      alert("Please enter a department name.");

      return;

    }



    try {

      const response = await fetch(

        `${API_URL}/organizations/${organization.id}/departments`,

        {

          method: "POST",

          headers: getAuthHeaders(),

          body: JSON.stringify({ name: departmentName }),

        }

      );



      if (response.status === 401) {

        handleAuthenticationFailure();

        return;

      }



      const data = await response.json().catch(() => ({}));



      if (!response.ok) {

        throw new Error(data.message || "Failed to create department.");

      }



      setNewDepartment("");

      await loadDepartments();

    } catch (error) {

      console.error("Failed to add department:", error);

      alert(error.message);

    }

  };



  const startEditDepartment = (department) => {

    setEditingDepartmentId(department.id);

    setEditingDepartmentName(department.name || "");

  };



  const cancelEditDepartment = () => {

    setEditingDepartmentId(null);

    setEditingDepartmentName("");

  };



  const saveDepartmentEdit = async () => {

    if (!organization?.id || !editingDepartmentId) return;



    const departmentName = editingDepartmentName.trim();



    if (!departmentName) {

      alert("Department name cannot be empty.");

      return;

    }



    try {

      const response = await fetch(

        `${API_URL}/organizations/${organization.id}/departments/${editingDepartmentId}`,

        {

          method: "PUT",

          headers: getAuthHeaders(),

          body: JSON.stringify({ name: departmentName }),

        }

      );



      if (response.status === 401) {

        handleAuthenticationFailure();

        return;

      }



      const data = await response.json().catch(() => ({}));



      if (!response.ok) {

        throw new Error(data.message || "Failed to update department.");

      }



      cancelEditDepartment();

      await loadDepartments();

      await loadReports();

    } catch (error) {

      console.error("Failed to update department:", error);

      alert(error.message);

    }

  };



  const deleteDepartment = async (department) => {

    if (!organization?.id || !department?.id) return;



    const confirmed = window.confirm(

      `Delete "${department.name}"? Make sure its cases and staff are reassigned first.`

    );



    if (!confirmed) return;



    try {

      const response = await fetch(

        `${API_URL}/organizations/${organization.id}/departments/${department.id}`,

        {

          method: "DELETE",

          headers: getAuthHeaders(),

        }

      );



      if (response.status === 401) {

        handleAuthenticationFailure();

        return;

      }



      const data = await response.json().catch(() => ({}));



      if (!response.ok) {

        throw new Error(data.message || "Failed to delete department.");

      }



      await loadDepartments();

      await loadStaff();

      await loadReports();



      if (

        selectedReport?.departmentId &&

        Number(selectedReport.departmentId) === Number(department.id)

      ) {

        setSelectedReport((previous) =>

          previous

            ? {

                ...previous,

                departmentId: null,

                departmentName: "",

                assignedStaffId: null,

                assignedStaffName: "",

              }

            : previous

        );



        setSelectedStaffId("");

      }

    } catch (error) {

      console.error("Failed to delete department:", error);

      alert(error.message);

    }

  };



  const departmentStaff = useMemo(() => {

    if (!selectedReport) return [];



    const selectedDepartmentId = Number(

      selectedReport.departmentId ?? selectedReport.department_id

    );



    if (!Number.isInteger(selectedDepartmentId) || selectedDepartmentId <= 0) {

      return [];

    }



    return staff.filter((member) => {

      const memberDepartmentId = Number(

        member.departmentId ?? member.department_id

      );



      const status = String(member.status || "").toLowerCase();



      const active =

        status === "active" ||

        member.isActive === true ||

        member.is_active === true;



      return (

        memberDepartmentId === selectedDepartmentId && active

      );

    });

  }, [staff, selectedReport]);



  const filteredReports = useMemo(() => {

    const search = searchTerm.trim().toLowerCase();



    return reports.filter((report) => {

      const matchesSearch =

        !search ||

        String(report.caseId || "").toLowerCase().includes(search) ||

        String(report.category || "").toLowerCase().includes(search) ||

        String(report.location || "").toLowerCase().includes(search) ||

        String(report.fullName || "").toLowerCase().includes(search);



      const matchesStatus =

        statusFilter === "All" || report.status === statusFilter;



      const matchesPriority =

        priorityFilter === "All" || report.priority === priorityFilter;



      return matchesSearch && matchesStatus && matchesPriority;

    });

  }, [reports, searchTerm, statusFilter, priorityFilter]);



  const stats = useMemo(() => {

    const total = reports.length;

    const received = reports.filter((r) => r.status === "Received").length;

    const inProgress = reports.filter((r) => r.status === "In Progress").length;

    const resolved = reports.filter((r) => r.status === "Resolved").length;

    const closed = reports.filter((r) => r.status === "Closed").length;



    const highPriority = reports.filter((r) =>

      ["High", "Critical", "Urgent"].includes(r.priority)

    ).length;



    return {

      total,

      received,

      inProgress,

      resolved,

      closed,

      highPriority,

    };

  }, [reports]);



  const formatDate = (dateValue) => {

    if (!dateValue) return "N/A";



    const date = new Date(dateValue);



    if (Number.isNaN(date.getTime())) return "N/A";



    return date.toLocaleString("en-KE", {

      dateStyle: "medium",

      timeStyle: "short",

    });

  };



  const getPriorityClass = (priority) =>

    String(priority || "Medium").toLowerCase().replace(/\s+/g, "-");



  const getStatusClass = (status) =>

    String(status || "Received").toLowerCase().replace(/\s+/g, "-");



  const handleLogout = () => {

    localStorage.removeItem("responsehub_token");

    localStorage.removeItem("responsehub_organization");

    localStorage.removeItem("responsehub_logged_in");

    navigate("/organization-login");

  };



  const closeCaseModal = () => {

    setSelectedReport(null);

    setSelectedStaffId("");

    setResponseText("");

  };



  if (!organization) {

    return (

      <div className="organization-page">

        <div className="organization-loading">

          Loading organization...

        </div>

      </div>

    );

  }



  return (

    <div className="organization-page">

      <aside className="organization-sidebar">

        <div className="organization-brand">

          <div className="organization-brand-logo">R</div>

          <div>

            <h2>ResponseHub</h2>

            <span>Organization Portal</span>

          </div>

        </div>



        <div className="organization-profile">

          <div className="organization-avatar">

            {String(organization.name || "O").charAt(0).toUpperCase()}

          </div>

          <div>

            <strong>{organization.name}</strong>

            <small>{organization.email || ""}</small>

          </div>

        </div>



        <nav className="organization-nav">

          <button

            className={activeSection === "dashboard" ? "active" : ""}

            onClick={() => setActiveSection("dashboard")}

          >

            Dashboard

          </button>



          <button

            className={activeSection === "departments" ? "active" : ""}

            onClick={() => setActiveSection("departments")}

          >

            Departments

          </button>



          <button

            className={activeSection === "staff" ? "active" : ""}

            onClick={() => setActiveSection("staff")}

          >

            Staff

          </button>

        </nav>



        <button className="organization-logout" onClick={handleLogout}>

          Logout

        </button>

      </aside>



      <main className="organization-main">

        {activeSection === "dashboard" && (

          <>

            <header className="organization-header">

              <div>

                <h1>Organization Dashboard</h1>

                <p>

                  Manage citizen reports, cases, departments and staff assignments.

                </p>

              </div>



              <button

                className="refresh-button"

                onClick={() => {

                  loadReports();

                  loadStaff();

                  loadDepartments();

                }}

              >

                Refresh

              </button>

            </header>



            <section className="organization-stats">

              <div className="stat-card">

                <span>Total Cases</span>

                <strong>{stats.total}</strong>

              </div>

              <div className="stat-card">

                <span>Received</span>

                <strong>{stats.received}</strong>

              </div>

              <div className="stat-card">

                <span>In Progress</span>

                <strong>{stats.inProgress}</strong>

              </div>

              <div className="stat-card">

                <span>Resolved</span>

                <strong>{stats.resolved}</strong>

              </div>

              <div className="stat-card">

                <span>High Priority</span>

                <strong>{stats.highPriority}</strong>

              </div>

            </section>



            <section className="organization-filters">

              <input

                type="text"

                placeholder="Search case, category, location or citizen..."

                value={searchTerm}

                onChange={(e) => setSearchTerm(e.target.value)}

              />



              <select

                value={statusFilter}

                onChange={(e) => setStatusFilter(e.target.value)}

              >

                <option value="All">All Statuses</option>

                <option value="Received">Received</option>

                <option value="In Progress">In Progress</option>

                <option value="Resolved">Resolved</option>

                <option value="Closed">Closed</option>

              </select>



              <select

                value={priorityFilter}

                onChange={(e) => setPriorityFilter(e.target.value)}

              >

                <option value="All">All Priorities</option>

                <option value="Low">Low</option>

                <option value="Medium">Medium</option>

                <option value="High">High</option>

                <option value="Critical">Critical</option>

              </select>

            </section>



            <section className="organization-reports">

              {loadingReports ? (

                <div className="empty-state">Loading reports...</div>

              ) : filteredReports.length === 0 ? (

                <div className="empty-state">No reports found.</div>

              ) : (

                <div className="reports-table-wrapper">

                  <table className="reports-table">

                    <thead>

                      <tr>

                        <th>Case ID</th>

                        <th>Category</th>

                        <th>Location</th>

                        <th>Priority</th>

                        <th>Status</th>

                        <th>Department</th>

                        <th>Assigned Staff</th>

                        <th>Submitted</th>

                        <th>Action</th>

                      </tr>

                    </thead>

                    <tbody>

                      {filteredReports.map((report) => (

                        <tr key={report.id || report.caseId}>

                          <td><strong>{report.caseId}</strong></td>

                          <td>{report.category}</td>

                          <td>{report.location}</td>

                          <td>

                            <span

                              className={`priority-badge ${getPriorityClass(

                                report.priority

                              )}`}

                            >

                              {report.priority}

                            </span>

                          </td>

                          <td>

                            <span

                              className={`status-badge ${getStatusClass(

                                report.status

                              )}`}

                            >

                              {report.status}

                            </span>

                          </td>

                          <td>{report.departmentName || "Not assigned"}</td>

                          <td>{report.assignedStaffName || "Not assigned"}</td>

                          <td>{formatDate(report.submittedAt)}</td>

                          <td>

                            <button

                              className="view-case-button"

                              onClick={() => handleOpenReport(report)}

                            >

                              View

                            </button>

                          </td>

                        </tr>

                      ))}

                    </tbody>

                  </table>

                </div>

              )}

            </section>

          </>

        )}



        {activeSection === "departments" && (

          <section className="departments-section">

            <header className="organization-header">

              <div>

                <h1>Departments</h1>

                <p>Create and manage departments for your organization.</p>

              </div>

            </header>



            <div className="department-create">

              <input

                type="text"

                placeholder="Department name"

                value={newDepartment}

                onChange={(e) => setNewDepartment(e.target.value)}

                onKeyDown={(e) => {

                  if (e.key === "Enter") addDepartment();

                }}

              />

              <button onClick={addDepartment}>Add Department</button>

            </div>



            <div className="department-list">

              {departments.length === 0 ? (

                <div className="empty-state">No departments found.</div>

              ) : (

                departments.map((department) => (

                  <div className="department-item" key={department.id}>

                    {editingDepartmentId === department.id ? (

                      <>

                        <input

                          type="text"

                          value={editingDepartmentName}

                          onChange={(e) =>

                            setEditingDepartmentName(e.target.value)

                          }

                        />

                        <div>

                          <button onClick={saveDepartmentEdit}>Save</button>

                          <button onClick={cancelEditDepartment}>Cancel</button>

                        </div>

                      </>

                    ) : (

                      <>

                        <div>

                          <strong>{department.name}</strong>

                          <small>Department ID: {department.id}</small>

                        </div>

                        <div>

                          <button

                            onClick={() => startEditDepartment(department)}

                          >

                            Edit

                          </button>

                          <button

                            onClick={() => deleteDepartment(department)}

                          >

                            Delete

                          </button>

                        </div>

                      </>

                    )}

                  </div>

                ))

              )}

            </div>

          </section>

        )}



        {activeSection === "staff" && (

          <section className="staff-section">

            <header className="organization-header">

              <div>

                <h1>Staff Management</h1>

                <p>

                  Manage staff members, duties, departments and account status.

                </p>

              </div>

            </header>



            <StaffManagement

              organization={organization}

              departments={departments}

              onStaffChanged={() => {

                loadStaff();

                loadReports();

              }}

            />

          </section>

        )}

      </main>



      {selectedReport && (

        <div

          className="case-modal-overlay"

          onClick={(e) => {

            if (e.target === e.currentTarget) closeCaseModal();

          }}

        >

          <div className="case-modal">

            <div className="case-modal-header">

              <div>

                <h2>Case {selectedReport.caseId}</h2>

                <p>

                  {selectedReport.category} • {selectedReport.location}

                </p>

              </div>

              <button

                className="close-modal-button"

                onClick={closeCaseModal}

              >

                ×

              </button>

            </div>



            {loadingCase ? (

              <div className="case-loading">Loading case details...</div>

            ) : (

              <div className="case-modal-body">

                <section className="case-controls">

                  <div className="case-control-group">

                    <label>Status</label>

                    <select

                      value={selectedReport.status || "Received"}

                      onChange={(e) => updateStatus(e.target.value)}

                      disabled={savingCase}

                    >

                      <option value="Received">Received</option>

                      <option value="In Progress">In Progress</option>

                      <option value="Resolved">Resolved</option>

                      <option value="Closed">Closed</option>

                    </select>

                  </div>



                  <div className="case-control-group">

                    <label>Priority</label>

                    <select

                      value={selectedReport.priority || "Medium"}

                      onChange={(e) => updatePriority(e.target.value)}

                      disabled={savingCase}

                    >

                      <option value="Low">Low</option>

                      <option value="Medium">Medium</option>

                      <option value="High">High</option>

                      <option value="Critical">Critical</option>

                    </select>

                  </div>

                </section>



                <section className="case-assignment-section">

                  <h3>Case Assignment</h3>

                  <div className="assignment-grid">

                    <div className="case-control-group">

                      <label>Department</label>

                      <select

                        value={

                          selectedReport.departmentId ??

                          selectedReport.department_id ??

                          ""

                        }

                        onChange={(e) => assignDepartment(e.target.value)}

                        disabled={savingCase}

                      >

                        <option value="">Select department</option>

                        {departments.map((department) => (

                          <option key={department.id} value={department.id}>

                            {department.name}

                          </option>

                        ))}

                      </select>

                    </div>



                    <div className="case-control-group">

                      <label>Assigned Staff</label>

                      <select

                        value={selectedStaffId}

                        onChange={(e) => setSelectedStaffId(e.target.value)}

                        disabled={

                          assigningCase ||

                          savingCase ||

                          !(

                            selectedReport.departmentId ??

                            selectedReport.department_id

                          )

                        }

                      >

                        <option value="">

                          {!(

                            selectedReport.departmentId ??

                            selectedReport.department_id

                          )

                            ? "Select department first"

                            : departmentStaff.length === 0

                            ? "No active staff in this department"

                            : "Select staff member"}

                        </option>



                        {departmentStaff.map((member) => {

                          const memberName =

                            member.fullName ||

                            member.full_name ||

                            member.name ||

                            member.staffId ||

                            member.staff_id ||

                            "Staff Member";



                          return (

                            <option key={member.id} value={member.id}>

                              {memberName}

                              {member.role ? ` — ${member.role}` : ""}

                              {member.duty ? ` (${member.duty})` : ""}

                            </option>

                          );

                        })}

                      </select>



                      <button

                        className="assign-staff-button"

                        onClick={assignStaff}

                        disabled={

                          assigningCase ||

                          savingCase ||

                          !selectedStaffId ||

                          departmentStaff.length === 0

                        }

                      >

                        {assigningCase ? "Assigning..." : "Assign Staff"}

                      </button>

                    </div>

                  </div>



                  <div className="current-assignment">

                    <strong>Current Department:</strong>{" "}

                    {selectedReport.departmentName || "Not assigned"}

                    <br />

                    <strong>Current Staff:</strong>{" "}

                    {selectedReport.assignedStaffName || "Not assigned"}

                  </div>

                </section>



                {selectedReport.assignmentHistory?.length > 0 && (

                  <section className="assignment-history">

                    <h3>Assignment History</h3>

                    <div className="case-activity">

                      {selectedReport.assignmentHistory.map((item, index) => (

                        <div

                          key={item.id || index}

                          className="activity-item"

                        >

                          <strong>

                            {item.message ||

                              item.activity_type ||

                              "Assignment updated"}

                          </strong>

                          <small>

                            {formatDate(item.created_at || item.createdAt)}

                          </small>

                        </div>

                      ))}

                    </div>

                  </section>

                )}



                <section className="case-information">

                  <h3>Report Details</h3>

                  <div className="case-detail-grid">

                    <div>

                      <span>Category</span>

                      <strong>{selectedReport.category}</strong>

                    </div>

                    <div>

                      <span>Location</span>

                      <strong>{selectedReport.location}</strong>

                    </div>

                    <div>

                      <span>Submitted</span>

                      <strong>{formatDate(selectedReport.submittedAt)}</strong>

                    </div>

                    <div>

                      <span>Updated</span>

                      <strong>{formatDate(selectedReport.updatedAt)}</strong>

                    </div>

                  </div>



                  <div className="case-description">

                    <h4>Description</h4>

                    <p>{selectedReport.description}</p>

                  </div>

                </section>



                <section className="citizen-information">

                  <h3>Citizen Information</h3>

                  {selectedReport.anonymous ? (

                    <p>This report was submitted anonymously.</p>

                  ) : (

                    <div className="case-detail-grid">

                      <div>

                        <span>Full Name</span>

                        <strong>{selectedReport.fullName || "N/A"}</strong>

                      </div>

                      <div>

                        <span>Phone</span>

                        <strong>{selectedReport.phone || "N/A"}</strong>

                      </div>

                      <div>

                        <span>Email</span>

                        <strong>{selectedReport.email || "N/A"}</strong>

                      </div>

                    </div>

                  )}

                </section>



                <section className="evidence-section">

                  <h3>Evidence</h3>



                  {selectedReport.evidence?.length > 0 ? (

                    <div className="evidence-list">

                      {selectedReport.evidence.map((file, index) => {

                        const fileUrl =

                          file.dataUrl ||

                          file.data_url ||

                          file.url ||

                          file.fileUrl ||

                          file.file_url ||

                          file.path ||

                          "";



                        const fileName =

                          file.fileName ||

                          file.file_name ||

                          file.name ||

                          `Evidence ${index + 1}`;



                        const fileType =

                          file.fileType ||

                          file.file_type ||

                          file.type ||

                          "";



                        const fileSize =

                          file.fileSize ??

                          file.file_size ??

                          file.size;



                        const readableSize =

                          typeof fileSize === "number"

                            ? fileSize < 1024 * 1024

                              ? `${(fileSize / 1024).toFixed(1)} KB`

                              : `${(fileSize / (1024 * 1024)).toFixed(2)} MB`

                            : "";



                        return (

                          <div

                            className="evidence-item"

                            key={file.id || file.evidence_id || index}

                          >

                            <div>

                              <strong>{fileName}</strong>

                              {fileType && <small>{fileType}</small>}

                              {readableSize && <small>{readableSize}</small>}

                            </div>



                            {fileUrl ? (

                              <div className="evidence-actions">

                                <button

                                  type="button"

                                  onClick={() => {
                                    const normalizedUrl =
                                      fileUrl.startsWith("/") &&
                                      !fileUrl.startsWith("//")
                                        ? `http://localhost:5000${fileUrl}`
                                        : fileUrl.startsWith("//")
                                        ? `${window.location.protocol}${fileUrl}`
                                        : fileUrl;

                                    setEvidencePreview({
                                      url: normalizedUrl,
                                      fileName,
                                      fileType,
                                    });
                                  }}

                                >

                                  Open

                                </button>



                                <a

                                  href={fileUrl}

                                  target="_blank"

                                  rel="noreferrer"

                                  download={fileName}

                                >

                                  Download

                                </a>

                              </div>

                            ) : (

                              <small>File data is unavailable.</small>

                            )}

                          </div>

                        );

                      })}

                    </div>

                  ) : (

                    <p>No evidence attached.</p>

                  )}

                
                  {evidencePreview && (
                    <div
                      className="evidence-preview-overlay"
                      onClick={(event) => {
                        if (event.target === event.currentTarget) setEvidencePreview(null);
                      }}
                      style={{
                        position: "fixed", inset: 0, zIndex: 10000,
                        background: "rgba(0,0,0,0.78)", display: "flex",
                        alignItems: "center", justifyContent: "center", padding: "20px",
                      }}
                    >
                      <div
                        style={{
                          background: "#fff", color: "#222", width: "min(1000px, 96vw)",
                          height: "min(820px, 92vh)", borderRadius: "12px",
                          display: "flex", flexDirection: "column", overflow: "hidden",
                        }}
                      >
                        <div style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          gap: "12px", padding: "12px 16px", borderBottom: "1px solid #ddd",
                        }}>
                          <strong style={{ overflowWrap: "anywhere" }}>{evidencePreview.fileName}</strong>
                          <button type="button" onClick={() => setEvidencePreview(null)}>
                            Close ✕
                          </button>
                        </div>
                        {/^image\//i.test(evidencePreview.fileType || "") ||
                        /^data:image\//i.test(evidencePreview.url) ||
                        /\.(jpe?g|png|gif|webp|bmp|svg)(\?.*)?$/i.test(
                          evidencePreview.fileName || evidencePreview.url
                        ) ? (
                          <div style={{
                            flex: 1, minHeight: 0, display: "flex", alignItems: "center",
                            justifyContent: "center", padding: "12px", overflow: "auto",
                          }}>
                            <img
                              src={evidencePreview.url}
                              alt={evidencePreview.fileName}
                              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                            />
                          </div>
                        ) : (
                          <iframe
                            title={`Preview of ${evidencePreview.fileName}`}
                            src={evidencePreview.url}
                            style={{ flex: 1, width: "100%", minHeight: 0, border: 0 }}
                          />
                        )}
                      </div>
                    </div>
                  )}

                </section>



                <section className="organization-response">

                  <h3>Organization Response</h3>

                  <textarea

                    value={responseText}

                    onChange={(e) => setResponseText(e.target.value)}

                    placeholder="Write your response to the citizen..."

                    rows={5}

                    disabled={savingCase}

                  />



                  <button

                    className="send-response-button"

                    onClick={saveResponse}

                    disabled={savingCase || !responseText.trim()}

                  >

                    {savingCase ? "Saving..." : "Send Response"}

                  </button>



                  {selectedReport.organizationResponse && (

                    <div className="previous-response">

                      <h4>Current Response</h4>

                      <p>{selectedReport.organizationResponse}</p>

                      <small>{formatDate(selectedReport.responseAt)}</small>

                    </div>

                  )}

                </section>



                <section className="case-activity-section">

                  <h3>Case Activity</h3>



                  {selectedReport.activity?.length > 0 ? (

                    <div className="case-activity">

                      {selectedReport.activity.map((item, index) => (

                        <div

                          className="activity-item"

                          key={item.id || index}

                        >

                          <div>

                            <strong>

                              {item.message ||

                                item.activity_type ||

                                "Case activity"}

                            </strong>

                            {item.old_value && item.new_value && (

                              <p>

                                {item.old_value} → {item.new_value}

                              </p>

                            )}

                          </div>

                          <small>

                            {formatDate(item.created_at || item.createdAt)}

                          </small>

                        </div>

                      ))}

                    </div>

                  ) : (

                    <p>No activity recorded yet.</p>

                  )}

                </section>

              </div>

            )}

          </div>

        </div>

      )}

    </div>

  );

}

export default Organization;