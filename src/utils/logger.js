
export const logToSheet = async (data) => {
    const url = import.meta.env.VITE_GOOGLE_SHEETS_URL;

    if (!url) {
        console.warn("Google Sheets URL not configured. Check .env file.");
        return;
    }

    try {
        // We use text/plain to avoid CORS Preflight (OPTIONS) requests which Google Script doesn't handle well
        await fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: JSON.stringify(data)
        });
        console.log("Log sent to spreadsheet");
    } catch (error) {
        console.error("Error logging to sheet:", error);
    }
};

export const fetchLogs = async () => {
    const url = import.meta.env.VITE_GOOGLE_SHEETS_URL;
    if (!url) return [];

    try {
        const res = await fetch(url);
        const data = await res.json();
        return data; // Expecting array of objects or arrays
    } catch (e) {
        console.error("Error fetching logs:", e);
        return [];
    }
};

export const updateLogStatus = async (rowIndex, status) => {
    const url = import.meta.env.VITE_GOOGLE_SHEETS_URL;
    if (!url) return;

    try {
        await fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: JSON.stringify({
                action: 'updateStatus',
                rowIndex: rowIndex,
                status: status,
                timestamp: new Date().toISOString()
            })
        });
        console.log("Status update sent:", rowIndex, status);
    } catch (error) {
        console.error("Error updating status:", error);
    }
};
