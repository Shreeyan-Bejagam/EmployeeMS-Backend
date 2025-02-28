import express from "express";
import con from "../utils/db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";


const router = express.Router();
/**
 * ✅ Admin, MD, Accounts TL, Finance TL, and Procurement TL Login
 */
router.post("/adminlogin", (req, res) => {
  const { email, password } = req.body;

  // ✅ Step 1: Check in `admin` table
  const sqlAdmin = "SELECT * FROM admin WHERE email = ?";
  con.query(sqlAdmin, [email], (err, result) => {
    if (err) return res.json({ loginStatus: false, Error: "Query error" });

    if (result.length > 0) {
      // ✅ Admin found, verify password (PLAIN TEXT in admin table)
      if (result[0].password === password) {
        const { id, email } = result[0];
        const token = jwt.sign({ role: "admin", email, id }, "jwt_secret_key", { expiresIn: "1d" });

        res.cookie("token", token, { httpOnly: true, secure: false, sameSite: "lax" });
        return res.json({ loginStatus: true, role: "admin" });
      } else {
        return res.json({ loginStatus: false, Error: "Wrong email or password" });
      }
    } else {
      // ✅ Step 2: If not in `admin`, check `employee` table
      const sqlEmployee = "SELECT * FROM employee WHERE email = ?";
      con.query(sqlEmployee, [email], (err, empResult) => {
        if (err) return res.json({ loginStatus: false, Error: "Query error" });

        if (empResult.length > 0) {
          // ✅ Employee found, verify password (BCRYPT in employee table)
          const { id, email, password: hashedPassword, department_id } = empResult[0];

          bcrypt.compare(password, hashedPassword, (err, response) => {
            if (err || !response) {
              return res.json({ loginStatus: false, Error: "Wrong email or password" });
            }

            let role = "employee";
            if (department_id == 16) role = "MD";
            else if (department_id == 32) role = "Accounts TL";
            else if (department_id == 33) role = "Finance TL";
            else if (department_id == 34) role = "Procurement TL"; // ✅ Recognizing Procurement TL

            // ✅ Generate token
            const token = jwt.sign({ role, email, id }, "jwt_secret_key", { expiresIn: "1d" });

            res.cookie("token", token, { httpOnly: true, secure: false, sameSite: "lax" });
            return res.json({ loginStatus: true, role });
          });
        } else {
          return res.json({ loginStatus: false, Error: "Wrong email or password" });
        }
      });
    }
  });
});

/**
 * ✅ Fetch Logged-in User Details (Admin, MD, Accounts TL)
 */
/**
 * ✅ Fetch Logged-in User Details (Admin, MD, Accounts TL, Finance TL)
 */
router.get("/user-details", (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.json({ Status: false, Error: "Not authenticated" });

  jwt.verify(token, "jwt_secret_key", (err, decoded) => {
    if (err) return res.json({ Status: false, Error: "Invalid token" });

    // ✅ Include `id` here (decoded.id comes from your login token)
    return res.json({
      Status: true,
      role: decoded.role,
      email: decoded.email,
      id: decoded.id  // ✅ This is the fix!
    });
  });
});



/**
 * Fetch Departments
 */
router.get("/departments", (req, res) => {
  const sql = "SELECT * FROM departments"; // ✅ Updated table name
  con.query(sql, (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });

    return res.json({ Status: true, Result: result });
  });
});

/**
 * Add Department
 */
router.post("/add_department", (req, res) => {
  const sql = "INSERT INTO departments (name) VALUES (?)"; // ✅ Updated table name
  con.query(sql, [req.body.department], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });

    return res.json({ Status: true });
  });
});



/**
 * Delete Department
 */
router.delete("/delete_department/:id", (req, res) => {
  const sql = "DELETE FROM departments WHERE id = ?"; // ✅ Updated table name
  con.query(sql, [req.params.id], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error: " + err });

    return res.json({ Status: true, Message: "Department deleted successfully!" });
  });
});

const uploadDir = "Public/Images";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Image & Document Upload Configuration
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + "_" + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

/**
 * Add Employee
 */
router.post("/add_employee", upload.fields([
  { name: "image", maxCount: 1 },
  { name: "resume", maxCount: 1 },
  { name: "tenth_memo", maxCount: 1 },
  { name: "inter_memo", maxCount: 1 },
  { name: "aadhar", maxCount: 1 },
  { name: "pan", maxCount: 1 }
]), async (req, res) => {
  try {
    console.log("Received Request Body:", req.body); // ✅ Debugging log
    console.log("Received Files:", req.files);

    if (!req.body.password) {
      return res.status(400).json({ Status: false, Error: "Password is required" });
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    const sql = `INSERT INTO employee 
      (name, email, password, address, department_id, image, dob, contact_number, parent_name, parent_number, joining_date, 
      resume, tenth_memo, inter_memo, aadhar, pan) 
      VALUES (?)`;

    const values = [
      req.body.name || "",
      req.body.email || "",
      hashedPassword,
      req.body.address || "",
      req.body.department_id || null,
      req.files["image"] ? req.files["image"][0].filename : null,
      req.body.dob || null,
      req.body.contact_number || null,
      req.body.parent_name || "",
      req.body.parent_number || "",
      req.body.joining_date || null,
      req.files["resume"] ? req.files["resume"][0].filename : null,
      req.files["tenth_memo"] ? req.files["tenth_memo"][0].filename : null,
      req.files["inter_memo"] ? req.files["inter_memo"][0].filename : null,
      req.files["aadhar"] ? req.files["aadhar"][0].filename : null,
      req.files["pan"] ? req.files["pan"][0].filename : null
    ];

    con.query(sql, [values], (err, result) => {
      if (err) {
        console.error("Database Error:", err.sqlMessage);
        return res.status(500).json({ Status: false, Error: err.sqlMessage });
      }

      // ✅ Insert teams into `employee_teams`
      const employeeId = result.insertId; // Get the newly inserted employee ID
      const teams = req.body.teams ? JSON.parse(req.body.teams) : []; // ✅ Parse JSON string to array

      console.log("Parsed Teams:", teams); // ✅ Debugging log to verify teams received
      if (teams.length > 0) {
        const teamInsertQuery = `INSERT INTO employee_teams (employee_id, team_id) VALUES ?`;
        const teamValues = teams.map(teamId => [employeeId, teamId]);
      
        con.query(teamInsertQuery, [teamValues], (err, teamResult) => {
          if (err) {
            console.error("❌ Error inserting employee teams:", err);
            return res.status(500).json({ Status: false, Error: "Error assigning teams" });
          }
          console.log("✅ Employee teams inserted:", teamValues); // 👈 Debugging Log
          return res.json({ Status: true, Message: "Employee and teams added successfully!" });
        });
      } else {
        console.log("⚠️ No teams assigned for employee:", employeeId);
        return res.json({ Status: true, Message: "Employee added successfully!" });
      }
      
    });
  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ Status: false, Error: "Internal Server Error" });
  }
});

/**
 * Fetch Employees
 */
router.get("/employee", (req, res) => {
  const sql = `
    SELECT employee.*, departments.name AS department_name 
    FROM employee 
    LEFT JOIN departments ON employee.department_id = departments.id
  `; // ✅ Fetch department name
  
  con.query(sql, (err, result) => {
    if (err) {
      console.error("Query Error:", err);
      return res.json({ Status: false, Error: "Query Error" });
    }

    return res.json({ Status: true, Result: result });
  });
});

/**
 * Fetch Employee by ID
 */
router.get("/employee/:id", (req, res) => {
  const sql = `
    SELECT employee.*, departments.name AS department_name 
    FROM employee 
    LEFT JOIN departments ON employee.department_id = departments.id 
    WHERE employee.id = ?
  `; // ✅ Fetch Department Name

  con.query(sql, [req.params.id], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });

    return res.json({ Status: true, Result: result });
  });
});

/**
 * Update Employee
 */
router.put("/edit_employee/:id", upload.fields([
  { name: "image", maxCount: 1 },
  { name: "resume", maxCount: 1 },
  { name: "tenth_memo", maxCount: 1 },
  { name: "inter_memo", maxCount: 1 },
  { name: "aadhar", maxCount: 1 },
  { name: "pan", maxCount: 1 }
]), (req, res) => {
  const id = req.params.id;
  const teams = req.body.teams ? JSON.parse(req.body.teams) : []; // ✅ Parse team IDs

  // ✅ Step 1: Update employee details
  const sql = `UPDATE employee SET 
    name = ?, email = ?, address = ?, image = ?, department_id = ?, dob = ?, 
    contact_number = ?, joining_date = ?, parent_name = ?, parent_number = ?, 
    resume = ?, tenth_memo = ?, inter_memo = ?, aadhar = ?, pan = ? 
    WHERE id = ?`;

  const values = [
    req.body.name,
    req.body.email,
    req.body.address,
    req.files["image"] ? req.files["image"][0].filename : req.body.existing_image,
    req.body.department_id,
    req.body.dob,
    req.body.contact_number,
    req.body.joining_date,
    req.body.parent_name,
    req.body.parent_number,
    req.files["resume"] ? req.files["resume"][0].filename : req.body.existing_resume,
    req.files["tenth_memo"] ? req.files["tenth_memo"][0].filename : req.body.existing_tenth_memo,
    req.files["inter_memo"] ? req.files["inter_memo"][0].filename : req.body.existing_inter_memo,
    req.files["aadhar"] ? req.files["aadhar"][0].filename : req.body.existing_aadhar,
    req.files["pan"] ? req.files["pan"][0].filename : req.body.existing_pan,
    id
  ];

  con.query(sql, values, (err, result) => {
    if (err) {
      console.error("❌ Error updating employee:", err);
      return res.json({ Status: false, Error: "Query Error" });
    }

    console.log("✅ Employee updated:", id);

    // ✅ Step 2: Remove old team assignments
    const deleteTeamsSql = `DELETE FROM employee_teams WHERE employee_id = ?`;
    con.query(deleteTeamsSql, [id], (deleteErr) => {
      if (deleteErr) {
        console.error("❌ Error deleting old teams:", deleteErr);
        return res.json({ Status: false, Error: "Failed to update teams" });
      }

      console.log("✅ Old teams removed");

      // ✅ Step 3: Insert new team assignments
      if (teams.length > 0) {
        const teamInsertQuery = `INSERT INTO employee_teams (employee_id, team_id) VALUES ?`;
        const teamValues = teams.map(teamId => [id, teamId]);

        con.query(teamInsertQuery, [teamValues], (insertErr) => {
          if (insertErr) {
            console.error("❌ Error inserting new teams:", insertErr);
            return res.json({ Status: false, Error: "Failed to assign new teams" });
          }

          console.log("✅ New teams assigned:", teamValues);
          return res.json({ Status: true, Message: "Employee updated successfully!" });
        });
      } else {
        console.log("⚠️ No teams assigned");
        return res.json({ Status: true, Message: "Employee updated successfully!" });
      }
    });
  });
});


/**
 * Delete Employee
 */
router.delete("/delete_employee/:id", (req, res) => {
  const sql = "DELETE FROM employee WHERE id = ?";
  con.query(sql, [req.params.id], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" + err });

    return res.json({ Status: true, Message: "Employee deleted successfully!" });
  });
});
/**
 * Fetch Admin Count
 */
router.get("/admin_count", (req, res) => {
  const sql = "SELECT COUNT(id) AS admin FROM admin";
  con.query(sql, (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" + err });

    return res.json({ Status: true, Result: result });
  });
});

/**
 * Fetch Employee Count
 */
router.get("/employee_count", (req, res) => {
  const sql = "SELECT COUNT(id) AS employee FROM employee";
  con.query(sql, (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" + err });

    return res.json({ Status: true, Result: result });
  });
});

/**
 * Delete Department
 */
router.delete("/delete_department/:id", (req, res) => {
  const sql = "DELETE FROM departments WHERE id = ?";
  con.query(sql, [req.params.id], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error: " + err });

    return res.json({ Status: true, Message: "Department deleted successfully!" });
  });
});


/**
 * Add Asset
 */
router.post("/add_asset", (req, res) => {
  const sql = `INSERT INTO assets 
    (asset_name, asset_type, stock, date_issued, liable_person, serial_number, status, current_holder, usage_start, usage_end, previous_holder) 
    VALUES (?, ?, ?, ?, ?, ?, 'Available', NULL, NULL, NULL, NULL)`;

  const values = [
    req.body.asset_name,
    req.body.asset_type,
    req.body.stock,
    req.body.date_issued,
    req.body.liable_person,
    req.body.serial_number || "N/A",
  ];

  con.query(sql, values, (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error: " + err.sqlMessage });

    return res.json({ Status: true });
  });
});

/**
 * Fetch All Assets
 */
/**
 * Fetch Assets with Optional Filtering by Type
 */
router.get("/assets", (req, res) => {
  const assetType = req.query.type; // Get type from query params

  let sql = "SELECT * FROM assets";
  let values = [];

  if (assetType && assetType !== "All") {
    sql += " WHERE asset_type = ?";
    values.push(assetType);
  }

  con.query(sql, values, (err, result) => {
    if (err) {
      console.error("❌ Error fetching assets:", err);
      return res.json({ Status: false, Error: "Query Error: " + err.sqlMessage });
    }
    return res.json({ Status: true, Result: result });
  });
});


router.post("/start_asset/:id", (req, res) => {
  const { user, duration, assetName, serialNumber } = req.body;
  const assetId = req.params.id;

  // Fetch the previous holder before updating
  const getPreviousHolderSql = `SELECT previous_holder FROM assets WHERE id = ?`;

  con.query(getPreviousHolderSql, [assetId], (err, result) => {
    if (err) {
      console.error("Error fetching previous holder:", err.sqlMessage);
      return res.json({ Status: false, Error: "Query Error: " + err.sqlMessage });
    }

    const previousHolder = result.length > 0 ? result[0].previous_holder : "N/A";

    // Update `assets` table to mark asset as Active
    const updateAssetSql = `UPDATE assets 
                            SET status = 'Active', 
                                previous_holder = current_holder, 
                                current_holder = ?, 
                                usage_start = NOW(), 
                                usage_end = NULL 
                            WHERE id = ?`;

    // Insert into `asset_logs` table for tracking asset usage
    const insertLogSql = `INSERT INTO asset_logs 
                          (asset_name, previous_holder, serial_number, borrowing_time, duration) 
                          VALUES (?, ?, ?, NOW(), ?)`;

    con.query(updateAssetSql, [user, assetId], (err, updateResult) => {
      if (err) {
        console.error("Error updating asset:", err.sqlMessage);
        return res.json({ Status: false, Error: "Query Error: " + err.sqlMessage });
      }

      // Insert new log entry with previous holder
      con.query(insertLogSql, [assetName, previousHolder, serialNumber, duration], (err, logResult) => {
        if (err) {
          console.error("Error inserting asset log:", err.sqlMessage);
          return res.json({ Status: false, Error: "Query Error: " + err.sqlMessage });
        }

        return res.json({ Status: true, Message: "Asset usage started successfully!", currentHolder: user });
      });
    });
  });
});

/**
 * Stop Asset Usage (Updates return time in `asset_logs`)
 */
router.post("/stop_asset/:id", (req, res) => {
  const assetId = req.params.id;

  // Get current user and update `return_time` in `asset_logs`
  const getCurrentUserSql = `SELECT current_holder FROM assets WHERE id = ?`;
  const updateLogSql = `UPDATE asset_logs 
                        SET return_time = NOW() 
                        WHERE liable_person = ? 
                        ORDER BY borrowing_time DESC 
                        LIMIT 1`;

  const updateAssetSql = `UPDATE assets 
                          SET status = 'Available', 
                              previous_holder = current_holder, 
                              current_holder = NULL, 
                              usage_end = NOW() 
                          WHERE id = ?`;

  con.query(getCurrentUserSql, [assetId], (err, result) => {
    if (err) {
      console.error("Error fetching current holder:", err.sqlMessage);
      return res.json({ Status: false, Error: "Query Error: " + err.sqlMessage });
    }

    if (result.length === 0 || !result[0].current_holder) {
      return res.json({ Status: false, Error: "No current holder found for this asset." });
    }

    const currentHolder = result[0].current_holder;

    // Update return time in asset logs
    con.query(updateLogSql, [currentHolder], (err, logResult) => {
      if (err) {
        console.error("Error updating asset log:", err.sqlMessage);
        return res.json({ Status: false, Error: "Query Error: " + err.sqlMessage });
      }

      // Mark asset as available
      con.query(updateAssetSql, [assetId], (err, result) => {
        if (err) {
          console.error("Error updating asset:", err.sqlMessage);
          return res.json({ Status: false, Error: "Query Error: " + err.sqlMessage });
        }

        return res.json({ Status: true, Message: "Asset usage stopped successfully!" });
      });
    });
  });
});


/**
 * Fetch Asset Logs
 */
router.get("/assetlogs", (req, res) => {
  const sql = "SELECT * FROM asset_logs ORDER BY borrowing_time DESC";
  con.query(sql, (err, result) => {
    if (err) {
      console.error("Error fetching asset logs:", err);
      return res.json({ Status: false, Error: "Query Error: " + err.sqlMessage });
    }
    return res.json({ Status: true, Result: result });
  });
});
router.get('/admin_records', (req, res) => {
  const sql = "select * from admin"
  con.query(sql, (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" + err })
    return res.json({ Status: true, Result: result })
  })
})

router.delete("/delete_asset/:id", (req, res) => {
  const sql = "DELETE FROM assets WHERE id = ?";
  con.query(sql, [req.params.id], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error: " + err });

    return res.json({ Status: true, Message: "Asset deleted successfully!" });
  });
});
// Fetch Teams
router.get("/teams", (req, res) => {
  con.query("SELECT * FROM teams", (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });
    return res.json({ Status: true, Result: result });
  });
});
// Fetch Employee Teams
// ✅ Fetch Employee Teams API
router.get("/employee_teams/:id", (req, res) => {
  const sql = `
    SELECT t.id, t.name 
    FROM employee_teams et
    JOIN teams t ON et.team_id = t.id
    WHERE et.employee_id = ?
  `;

  con.query(sql, [req.params.id], (err, result) => {
    if (err) {
      console.error("❌ Error fetching employee teams:", err);
      return res.json({ Status: false, Error: "Query Error" });
    }

    console.log("✅ Fetched Employee Teams:", result); // 👈 Debug Log
    return res.json({ Status: true, Result: result });
  });
});



// Add Team
router.post("/add_team", (req, res) => {
  const sql = "INSERT INTO teams (name) VALUES (?)";
  con.query(sql, [req.body.name], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });
    return res.json({ Status: true, id: result.insertId });
  });
});
// Delete Department
router.delete("/delete_department/:id", (req, res) => {
  const sql = "DELETE FROM departments WHERE id = ?";
  
  con.query(sql, [req.params.id], (err, result) => {
    if (err) {
      console.error("Error deleting department:", err);
      return res.json({ Status: false, Error: "Query Error: " + err });
    }

    return res.json({ Status: true, Message: "Department deleted successfully!" });
  });
});

// Delete Team
router.delete("/delete_team/:id", (req, res) => {
  con.query("DELETE FROM teams WHERE id = ?", [req.params.id], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });
    return res.json({ Status: true });
  });
});
/**
 * Fetch Employees by Department ID
 */
router.get("/department_employees/:id", (req, res) => {
  const sql = `
    SELECT e.id, e.name, e.email, d.name AS department_name, t.name AS team_name 
    FROM employee e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN employee_teams et ON e.id = et.employee_id
    LEFT JOIN teams t ON et.team_id = t.id
    WHERE e.department_id = ?
  `;

  con.query(sql, [req.params.id], (err, result) => {
    if (err) {
      console.error("Error fetching department employees:", err);
      return res.json({ Status: false, Error: "Query Error" });
    }

    return res.json({ Status: true, Result: result });
  });
});


router.get('/logout', (req, res) => {
  res.clearCookie('token')
  return res.json({ Status: true })
})

export { router as adminRouter };
