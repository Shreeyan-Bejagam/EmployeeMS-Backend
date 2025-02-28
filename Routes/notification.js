import express from "express";
import con from "../utils/db.js";

const router = express.Router();

/**
 * ✅ Send Notification to MD and TLs when TeamLead Approves an Asset Request
 */
router.post("/send_notification", (req, res) => {
    const { request_id, teamlead_id } = req.body;

    // ✅ Get TeamLead's Name
    const sqlGetTeamLead = "SELECT name FROM team_leads WHERE id = ?";
    con.query(sqlGetTeamLead, [teamlead_id], (err, result) => {
        if (err) {
            console.error("❌ Error fetching TeamLead name:", err);
            return res.status(500).json({ Status: false, Error: "Error fetching TeamLead details" });
        }

        const teamLeadName = result[0]?.name || "A Team Lead";

        // ✅ Insert Notification for MD and Other TLs
        const notificationMessage = `${teamLeadName} has approved an asset request.`;
        const sqlInsertNotification = `
            INSERT INTO notifications (request_id, user_id, message, status) 
            VALUES 
            (?, (SELECT id FROM employee WHERE department_id = 16 LIMIT 1), ?, 'unread'),  -- MD
            (?, (SELECT id FROM employee WHERE department_id = 32 LIMIT 1), ?, 'unread'),  -- Accounts TL
            (?, (SELECT id FROM employee WHERE department_id = 33 LIMIT 1), ?, 'unread'),  -- Finance TL
            (?, (SELECT id FROM employee WHERE department_id = 34 LIMIT 1), ?, 'unread')   -- Procurement TL
        `;

        con.query(
            sqlInsertNotification,
            [request_id, notificationMessage, request_id, notificationMessage, request_id, notificationMessage, request_id, notificationMessage],
            (err, result) => {
                if (err) {
                    console.error("❌ Error inserting notifications:", err);
                    return res.status(500).json({ Status: false, Error: "Database Error while inserting notifications" });
                }
                return res.json({ Status: true, Message: "Notifications sent successfully to MD and TLs" });
            }
        );
    });
});

/**
 * ✅ Fetch Notifications for MD & TLs
 */
router.get("/notifications/:user_id", (req, res) => {
    const user_id = req.params.user_id;

    const sql = "SELECT * FROM notifications WHERE user_id = ? AND status = 'unread' ORDER BY created_at DESC";
    con.query(sql, [user_id], (err, result) => {
        if (err) {
            console.error("❌ Error fetching notifications:", err);
            return res.status(500).json({ Status: false, Error: "Database Error while fetching notifications" });
        }
        return res.json({ Status: true, Result: result });
    });
});

/**
 * ✅ Mark Notification as Read
 */
router.post("/notifications/mark_as_read/:notification_id", (req, res) => {
    const notification_id = req.params.notification_id;

    const sql = "UPDATE notifications SET status = 'read' WHERE id = ?";
    con.query(sql, [notification_id], (err, result) => {
        if (err) {
            console.error("❌ Error updating notification:", err);
            return res.status(500).json({ Status: false, Error: "Database Error while updating notification" });
        }
        return res.json({ Status: true, Message: "Notification marked as read" });
    });
});



export { router as NotificationRouter }; // ✅ Correct Export
