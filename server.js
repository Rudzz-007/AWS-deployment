require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// API Routes
// ==========================================

/**
 * Health Check Endpoint for AWS CloudWatch / Auto Scaling / Application Load Balancer
 * Core Requirement: {"status": "ok", "uptime": process.uptime()}
 */
app.get('/health', (req, res) => {
  const status = db.getStatus();
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    storageMode: status.mode,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Get System & AWS Connection Status
 */
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    data: db.getStatus(),
  });
});

/**
 * Recheck AWS Connection on demand
 */
app.post('/api/status/recheck', async (req, res) => {
  try {
    const updatedStatus = await db.initDb();
    res.json({
      success: true,
      data: updatedStatus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * List all students
 */
app.get('/api/students', async (req, res) => {
  try {
    const students = await db.getAllStudents();
    res.json({
      success: true,
      count: students.length,
      storageMode: db.getStatus().mode,
      data: students,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching student records',
    });
  }
});

/**
 * Get single student by ID
 */
app.get('/api/students/:id', async (req, res) => {
  try {
    const student = await db.getStudentById(req.params.id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: `Student with ID "${req.params.id}" was not found`,
      });
    }
    res.json({
      success: true,
      data: student,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching student record',
    });
  }
});

/**
 * Create a new student record
 */
app.post('/api/students', async (req, res) => {
  try {
    const { studentId, name, course, email } = req.body;

    if (!studentId || !name || !course || !email) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: studentId, name, course, and email are all required.',
      });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    const createdRecord = await db.createStudent({ studentId, name, course, email });
    res.status(201).json({
      success: true,
      message: 'Student record created successfully',
      data: createdRecord,
      storageMode: db.getStatus().mode,
    });
  } catch (error) {
    const status = error.message.includes('already exists') ? 409 : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to create student record',
    });
  }
});

/**
 * Delete a student record by studentId
 */
app.delete('/api/students/:id', async (req, res) => {
  try {
    const result = await db.deleteStudent(req.params.id);
    res.json({
      success: true,
      message: `Student record "${req.params.id}" was successfully deleted`,
      data: result,
      storageMode: db.getStatus().mode,
    });
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to delete student record',
    });
  }
});

/**
 * Reset mock data (Mock Mode helper)
 */
app.post('/api/mock/reset', (req, res) => {
  const resetList = db.resetMockData();
  res.json({
    success: true,
    message: 'Mock student records reset to demo dataset',
    count: resetList.length,
    data: resetList,
  });
});

// Fallback route for SPA / root
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized error handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON payload received in request body',
    });
  }

  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start Server
async function startServer() {
  await db.initDb();

  app.listen(PORT, () => {
    const dbStatus = db.getStatus();
    console.log('\n=============================================================');
    console.log('  🎓 Student Record Management System (AWS Ready)            ');
    console.log('=============================================================');
    console.log(`  🌐 Server running at: http://localhost:${PORT}`);
    console.log(`  🩺 Health check:      http://localhost:${PORT}/health`);
    console.log(`  📡 Storage Backend:   ${dbStatus.mode.toUpperCase()}`);
    console.log(`  ☁️  AWS Region:       ${dbStatus.region}`);
    console.log(`  📊 DynamoDB Table:   ${dbStatus.tableName}`);
    console.log(`  💬 Status Note:       ${dbStatus.message}`);
    console.log('=============================================================\n');
  });
}

startServer();
