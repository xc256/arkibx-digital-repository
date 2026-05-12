import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "./style.css";

const API = "/api";

const defaultMetadataFields = [
  { key: "dc_title", label: "Title", type: "text", required: true },
  { key: "dc_subject", label: "Subject", type: "text", required: false },
  { key: "dc_description", label: "Description", type: "textarea", required: false },
  { key: "dc_creator", label: "Creator", type: "text", required: false },
  { key: "dc_publisher", label: "Publisher", type: "text", required: false },
  { key: "dc_contributor", label: "Contributor", type: "text", required: false },
  { key: "dc_date", label: "Date", type: "date", required: false },
  { key: "dc_type", label: "Type", type: "text", required: false },
  { key: "dc_format", label: "Format", type: "text", required: false },
  { key: "dc_identifier", label: "Identifier", type: "text", required: false },
  { key: "dc_source", label: "Source", type: "text", required: false },
  { key: "dc_language", label: "Language", type: "text", required: false },
  { key: "dc_relation", label: "Relation", type: "text", required: false },
  { key: "dc_coverage", label: "Coverage", type: "text", required: false },
  { key: "dc_rights", label: "Rights", type: "text", required: false }
];

function getMetadataFields() {
  const saved = localStorage.getItem("arkibx_metadata_fields");
  return saved ? JSON.parse(saved) : defaultMetadataFields;
}

function App() {
  const [page, setPage] = useState("home");
  const [selectedItem, setSelectedItem] = useState(null);
  const [items, setItems] = useState([]);
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [error, setError] = useState("");

  useEffect(() => {
    loadItems();
    const timer = setInterval(loadItems, 10000);
    return () => clearInterval(timer);
  }, []);

  async function loadItems() {
    try {
      const savedToken = localStorage.getItem("token");
      const res = await fetch(`${API}/items`, {
        headers: savedToken ? { Authorization: `Bearer ${savedToken}` } : {}
      });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    }
  }

  function openDetails(item) {
    setSelectedItem(item);
    setPage("details");
  }

  async function login(e) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.target);

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password")
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Login failed");
        return;
      }

      localStorage.setItem("token", data.access_token);
      setToken(data.access_token);
      await loadItems();
      setPage("dashboard");
    } catch {
      setError("Server error");
    }
  }

  async function register(e) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.target);

    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password")
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Registration failed");
        return;
      }

      setPage("login");
    } catch {
      setError("Server error");
    }
  }

  async function uploadItem(e) {
    e.preventDefault();
    setError("");

    const form = new FormData(e.target);
    const file = form.get("file");

    if (!file || file.size === 0) {
      setError("Please choose a file before uploading");
      return;
    }

    const metadata = {};

    for (const [key, value] of form.entries()) {
      if (key !== "file") {
        metadata[key] = value;
      }
    }

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const safeTitle = (metadata.dc_title || "item")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    metadata.dc_identifier =
      metadata.dc_identifier && metadata.dc_identifier.trim() !== ""
        ? metadata.dc_identifier.trim()
        : `ARKIBX-${timestamp}-${random}-${safeTitle}`;

    metadata.status = "published";
    metadata.visibility = "internal";

    try {
      const createRes = await fetch(`${API}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(metadata)
      });

      const createdItem = await createRes.json();

      if (!createRes.ok) {
        setError(createdItem.detail || "Failed to create metadata");
        return;
      }

      const uploadForm = new FormData();
      uploadForm.append("file", file);

      const uploadRes = await fetch(`${API}/items/${createdItem.id}/files`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: uploadForm
      });

      if (!uploadRes.ok) {
        setError("Metadata saved, but file upload failed");
        return;
      }

      e.target.reset();
      await loadItems();
      setPage("home");
    } catch {
      setError("Server error");
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setToken("");
    setItems([]);
    setPage("home");
  }

  return (
    <div>
      <nav className="topnav">
        <strong>ArkibX</strong>

        <div>
          <button onClick={() => setPage("home")}>Home</button>
          {!token && <button onClick={() => setPage("login")}>Login</button>}
          {!token && <button onClick={() => setPage("register")}>Create Account</button>}
          {token && <button onClick={() => setPage("dashboard")}>Upload Item</button>}
          {token && <button onClick={() => setPage("adminDeposits")}>Admin Deposits</button>}
          {token && <button onClick={() => setPage("adminMetadata")}>Admin Metadata</button>}
          {token && <button onClick={logout}>Logout</button>}
        </div>
      </nav>

      {page === "home" && <Home items={items} openDetails={openDetails} />}
      {page === "details" && <ItemDetails item={selectedItem} setPage={setPage} />}
      {page === "login" && <Login login={login} error={error} />}
      {page === "register" && <Register register={register} error={error} />}
      {page === "dashboard" && <Dashboard uploadItem={uploadItem} error={error} />}
      {page === "adminDeposits" && <AdminDeposits token={token} />}
      {page === "adminMetadata" && <AdminMetadata />}
    </div>
  );
}

function Home({ items, openDetails }) {
  const [search, setSearch] = useState("");

  const filteredItems = items.filter((item) => {
    const keyword = search.toLowerCase();

    return (
      (item.dc_title || "").toLowerCase().includes(keyword) ||
      (item.dc_subject || "").toLowerCase().includes(keyword) ||
      (item.dc_description || "").toLowerCase().includes(keyword) ||
      (item.dc_creator || "").toLowerCase().includes(keyword) ||
      (item.department || "").toLowerCase().includes(keyword) ||
      (item.resource_type || "").toLowerCase().includes(keyword)
    );
  });

  return (
    <div className="homepage">
      <header className="hero">
        <div className="hero-badge">Enterprise Digital Repository Platform</div>
        <h1>ArkibX</h1>
        <p>Modern Digital Repository & Archive Platform for institutions.</p>

        <div className="hero-stats">
          <div><strong>Dublin Core</strong><span>Metadata Standard</span></div>
          <div><strong>Enterprise</strong><span>Archive System</span></div>
          <div><strong>Searchable</strong><span>Digital Assets</span></div>
        </div>
      </header>

      <section className="search-section">
        <h2>Search Repository</h2>
        <div className="search-box">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, creator, subject, department..."
          />
          <button type="button">Search</button>
        </div>
      </section>

      <section className="latest">
        <h2>{search ? "Search Results" : "Latest Uploaded Items"}</h2>
        <p className="muted">
          {search ? `${filteredItems.length} result(s) found` : "Auto-refreshing latest uploads."}
        </p>

        <div className="item-grid">
          {filteredItems.length === 0 && <p>No items found.</p>}

          {filteredItems.slice(0, 12).map((item) => (
            <div className="item-card clickable-card" key={item.id} onClick={() => openDetails(item)}>
              {item.file_url && <img src={item.file_url} alt={item.dc_title || "Item"} />}
              <h3>{item.dc_title}</h3>
              <p>{item.dc_description}</p>
              <small>{item.resource_type}</small>
              <br />
              <small>{item.department}</small>

              <button
                type="button"
                className="view-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  openDetails(item);
                }}
              >
                View Details
              </button>
            </div>
          ))}
        </div>
      </section>

      <footer>
        <div className="footer-brand">
          <h2>ArkibX</h2>
          <p>Enterprise Digital Repository Platform</p>
        </div>
        <div className="footer-bottom">© 2026 ArkibX. All Rights Reserved.</div>
      </footer>
    </div>
  );
}

function ItemDetails({ item, setPage }) {
  if (!item) {
    return (
      <main className="eprint-page">
        <button className="back-btn" onClick={() => setPage("home")}>Back</button>
        <p>No item selected.</p>
      </main>
    );
  }

  const file = item.files && item.files.length > 0 ? item.files[0] : null;
  const fileUrl = file ? file.filepath : "";
  const mime = file ? file.mime_type || "" : "";

  return (
    <main className="eprint-page">
      <button className="back-btn" onClick={() => setPage("home")}>
        Back to Repository
      </button>

      <div className="eprint-header">
        <h1>{item.dc_title || "Untitled Item"}</h1>
        <p>
          {item.dc_creator || "Unknown creator"} ({item.dc_date || "Undated"}) {item.dc_title || "Untitled Item"}.
        </p>
      </div>

      <div className="eprint-layout">
        <section className="eprint-main">
          <h2>Preview</h2>

          <div className="eprint-preview">
            {file && mime.startsWith("image") && (
              <img src={fileUrl} alt={file.filename} />
            )}

            {file && mime.startsWith("video") && (
              <video controls src={fileUrl}></video>
            )}

            {file && mime === "application/pdf" && (
              <iframe src={fileUrl} title={file.filename}></iframe>
            )}

            {!file && <p>No file preview available.</p>}

            {file && !mime.startsWith("image") && !mime.startsWith("video") && mime !== "application/pdf" && (
              <a href={fileUrl} target="_blank" rel="noreferrer">
                Open File
              </a>
            )}
          </div>

          <h2>Abstract / Description</h2>
          <p className="abstract-text">{item.dc_description || "-"}</p>
        </section>

        <aside className="eprint-sidebar">
          <div className="download-box">
            <h3>Available Files</h3>

            {file ? (
              <a href={fileUrl} target="_blank" rel="noreferrer" className="download-btn">
                View / Download File
              </a>
            ) : (
              <p>No file attached.</p>
            )}
          </div>

          <div className="download-box">
            <h3>Repository Information</h3>
            <p><strong>Type:</strong> {item.resource_type || "-"}</p>
            <p><strong>Status:</strong> {item.status || "Published"}</p>
            <p><strong>Visibility:</strong> {item.visibility || "Internal"}</p>
          </div>
        </aside>
      </div>

      <section className="eprint-metadata">
        <h2>Item Metadata</h2>

        <table>
          <tbody>
            <tr><th>Department</th><td>{item.department || "-"}</td></tr>
            <tr><th>Resource Type</th><td>{item.resource_type || "-"}</td></tr>
            <tr><th>Title</th><td>{item.dc_title || "-"}</td></tr>
            <tr><th>Subject</th><td>{item.dc_subject || "-"}</td></tr>
            <tr><th>Description</th><td>{item.dc_description || "-"}</td></tr>
            <tr><th>Creator</th><td>{item.dc_creator || "-"}</td></tr>
            <tr><th>Publisher</th><td>{item.dc_publisher || "-"}</td></tr>
            <tr><th>Contributor</th><td>{item.dc_contributor || "-"}</td></tr>
            <tr><th>Date</th><td>{item.dc_date || "-"}</td></tr>
            <tr><th>Type</th><td>{item.dc_type || "-"}</td></tr>
            <tr><th>Format</th><td>{item.dc_format || "-"}</td></tr>
            <tr><th>Identifier</th><td>{item.dc_identifier || "-"}</td></tr>
            <tr><th>Source</th><td>{item.dc_source || "-"}</td></tr>
            <tr><th>Language</th><td>{item.dc_language || "-"}</td></tr>
            <tr><th>Relation</th><td>{item.dc_relation || "-"}</td></tr>
            <tr><th>Coverage</th><td>{item.dc_coverage || "-"}</td></tr>
            <tr><th>Rights</th><td>{item.dc_rights || "-"}</td></tr>
          </tbody>
        </table>
      </section>
    </main>
  );
}

function Login({ login, error }) {
  return (
    <main className="auth-box">
      <h1>ArkibX</h1>
      <p>Enterprise Repository Access Portal</p>
      <form onSubmit={login}>
        <input name="email" type="email" placeholder="Email" required />
        <input name="password" type="password" placeholder="Password" required />
        <button>Login</button>
      </form>
      {error && <p className="error">{error}</p>}
    </main>
  );
}

function Register({ register, error }) {
  return (
    <main className="register-landing">
      <section className="register-hero">
        <div>
          <span className="register-badge">Join ArkibX</span>
          <h1>Create Your Repository Account</h1>
          <p>
            Access a modern digital archive platform for managing institutional
            records, media, reports, photos, videos, and Dublin Core metadata.
          </p>

          <div className="register-benefits">
            <div>✓ Upload digital assets</div>
            <div>✓ Manage Dublin Core metadata</div>
            <div>✓ Search and preview repository items</div>
            <div>✓ Secure enterprise archive access</div>
          </div>
        </div>

        <form className="register-card" onSubmit={register}>
          <h2>Create Account</h2>
          <p>Start using ArkibX Digital Repository.</p>

          <input name="name" placeholder="Full Name" required />
          <input name="email" type="email" placeholder="Email Address" required />
          <input name="password" type="password" placeholder="Password" required />

          <button>Create Account</button>

          {error && <p className="error">{error}</p>}
        </form>
      </section>
    </main>
  );
}

function Dashboard({ uploadItem, error }) {
  const fields = getMetadataFields();

  return (
    <main className="upload-box">
      <h1>Upload Repository Item</h1>

      <form onSubmit={uploadItem}>
        <select name="department" required>
          <option value="">Select Department</option>
          <option value="Corporate Communications">Corporate Communications</option>
          <option value="Finance">Finance</option>
          <option value="Human Resource">Human Resource</option>
          <option value="Information Technology">Information Technology</option>
          <option value="Business Development">Business Development</option>
          <option value="Research and Innovation">Research and Innovation</option>
          <option value="Legal">Legal</option>
          <option value="Administration">Administration</option>
          <option value="Digital and Media">Digital and Media</option>
          <option value="Management">Management</option>
        </select>

        <select name="resource_type" required>
          <option value="">Select Resource Type</option>
          <option value="PHOTO">Photo</option>
          <option value="ARTICLE">Article</option>
          <option value="VIDEO">Video</option>
          <option value="REPORT">Report</option>
        </select>

        {fields.map((field) => {
          if (field.type === "textarea") {
            return (
              <textarea
                key={field.key}
                name={field.key}
                placeholder={field.label}
                required={field.required}
              />
            );
          }

          return (
            <input
              key={field.key}
              name={field.key}
              type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
              placeholder={field.label}
              required={field.required}
              defaultValue={
                field.key === "dc_publisher"
                  ? "ArkibX Corporation"
                  : field.key === "dc_rights"
                  ? "© 2026 ArkibX Corporation"
                  : ""
              }
            />
          );
        })}

        <label>Upload File</label>
        <input name="file" type="file" required />
        <button>Upload Item</button>
      </form>

      {error && <p className="error">{error}</p>}
    </main>
  );
}

function AdminDeposits({ token }) {
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    try {
      const res = await fetch(`${API}/items`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    }
  }

  async function deleteItem(id) {
    if (!window.confirm("Delete this deposit?")) return;

    try {
      const res = await fetch(`${API}/items/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        setMessage("Failed to delete deposit");
        return;
      }

      setMessage("Deposit deleted successfully");
      await loadItems();
    } catch {
      setMessage("Server error while deleting deposit");
    }
  }

  return (
    <main className="admin-box">
      <h1>Admin Deposits</h1>
      <p>Manage uploaded repository deposits.</p>
      {message && <p className="success-msg">{message}</p>}

      <div className="deposit-table">
        <div className="deposit-row deposit-header">
          <strong>Title</strong>
          <strong>Type</strong>
          <strong>Department</strong>
          <strong>Date</strong>
          <strong>Actions</strong>
        </div>

        {items.length === 0 && <p>No deposits found.</p>}

        {items.map((item) => (
          <div className="deposit-row" key={item.id}>
            <span>{item.dc_title || "-"}</span>
            <span>{item.resource_type || "-"}</span>
            <span>{item.department || "-"}</span>
            <span>{item.dc_date || "-"}</span>
            <div className="deposit-actions">
              <button className="danger-btn" onClick={() => deleteItem(item.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function AdminMetadata() {
  const [fields, setFields] = useState(getMetadataFields());

  function saveFields(updatedFields) {
    setFields(updatedFields);
    localStorage.setItem("arkibx_metadata_fields", JSON.stringify(updatedFields));
  }

  function addField() {
    saveFields([...fields, { key: "", label: "", type: "text", required: false }]);
  }

  function updateField(index, field, value) {
    const updated = [...fields];
    updated[index][field] = value;
    saveFields(updated);
  }

  function removeField(index) {
    saveFields(fields.filter((_, i) => i !== index));
  }

  function resetFields() {
    saveFields(defaultMetadataFields);
  }

  return (
    <main className="admin-box">
      <h1>Metadata Builder</h1>
      <p>Customize the repository metadata form used by ArkibX.</p>

      <div className="admin-actions">
        <button onClick={addField}>Add Metadata Field</button>
        <button onClick={resetFields} className="secondary-btn">Reset Dublin Core</button>
      </div>

      <div className="metadata-table">
        <div className="metadata-row metadata-header">
          <strong>Key</strong>
          <strong>Label</strong>
          <strong>Type</strong>
          <strong>Required</strong>
          <strong>Action</strong>
        </div>

        {fields.map((field, index) => (
          <div className="metadata-row" key={index}>
            <input value={field.key} placeholder="dc_title" onChange={(e) => updateField(index, "key", e.target.value)} />
            <input value={field.label} placeholder="Title" onChange={(e) => updateField(index, "label", e.target.value)} />

            <select value={field.type} onChange={(e) => updateField(index, "type", e.target.value)}>
              <option value="text">Text</option>
              <option value="textarea">Textarea</option>
              <option value="date">Date</option>
              <option value="number">Number</option>
            </select>

            <select value={field.required ? "yes" : "no"} onChange={(e) => updateField(index, "required", e.target.value === "yes")}>
              <option value="yes">Required</option>
              <option value="no">Optional</option>
            </select>

            <button onClick={() => removeField(index)} className="danger-btn">Remove</button>
          </div>
        ))}
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
