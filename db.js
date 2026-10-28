const { DynamoDBClient, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  DeleteCommand,
  GetCommand,
} = require('@aws-sdk/lib-dynamodb');

let NodeHttpHandler;
try {
  ({ NodeHttpHandler } = require('@smithy/node-http-handler'));
} catch {
  // Graceful fallback if not found in custom environments
}

// Configuration from environment variables
const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'StudentRecords';
const FORCE_MOCK = process.env.FORCE_MOCK_MODE === 'true';

// Initial dummy/mock records for seamless local testing
const INITIAL_MOCK_STUDENTS = [
  {
    studentId: 'STU-2026-001',
    name: 'Aarav Sharma',
    course: 'Cloud Computing & AWS Architecture',
    email: 'aarav.sharma@example.com',
    timestamp: new Date(Date.now() - 3600 * 1000 * 24 * 3).toISOString(),
  },
  {
    studentId: 'STU-2026-002',
    name: 'Sophia Chen',
    course: 'Full-Stack Modern Web Engineering',
    email: 'sophia.chen@example.com',
    timestamp: new Date(Date.now() - 3600 * 1000 * 24 * 2).toISOString(),
  },
  {
    studentId: 'STU-2026-003',
    name: 'Liam Patel',
    course: 'DevOps, CI/CD & Kubernetes',
    email: 'liam.patel@example.com',
    timestamp: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
  },
  {
    studentId: 'STU-2026-004',
    name: 'Elena Rostova',
    course: 'Data Science & Machine Learning Systems',
    email: 'elena.rostova@example.com',
    timestamp: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
  },
];

// In-Memory Storage
let mockStudents = JSON.parse(JSON.stringify(INITIAL_MOCK_STUDENTS));

// State tracking
let isMockMode = true;
let connectionStatus = 'initializing';
let statusMessage = 'Checking database connectivity...';
let ddbClient = null;
let docClient = null;

/**
 * Configure AWS DynamoDB Client using Default Credential Provider Chain.
 * - When running on EC2, picks up IAM Role automatically via IMDS.
 * - When running locally with .env credentials, uses provided keys.
 * - If neither is present, fallback gracefully handled without crashing.
 */
function buildAwsClients() {
  const clientConfig = {
    region: AWS_REGION,
  };

  // Configure connection & socket timeouts to prevent hanging if AWS is unreachable
  if (NodeHttpHandler) {
    clientConfig.requestHandler = new NodeHttpHandler({
      connectionTimeout: 4000,
      requestTimeout: 4000,
    });
  }

  // If developer provided explicit keys in .env, use them; otherwise use default provider chain (EC2 IAM Role)
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    clientConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
    };
  }

  ddbClient = new DynamoDBClient(clientConfig);
  docClient = DynamoDBDocumentClient.from(ddbClient, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertEmptyValues: true,
    },
  });
}

/**
 * Initialize and verify Database connection.
 * Tests table accessibility via DescribeTableCommand.
 */
async function initDb() {
  if (FORCE_MOCK) {
    isMockMode = true;
    connectionStatus = 'mock_forced';
    statusMessage = 'Running on Local Mock Data (FORCE_MOCK_MODE=true)';
    console.log(`[Storage] 🔶 ${statusMessage}`);
    return getStatus();
  }

  try {
    buildAwsClients();
    console.log(`[Storage] 🔄 Testing AWS DynamoDB connection (Table: "${TABLE_NAME}", Region: "${AWS_REGION}")...`);
    
    // Probe DynamoDB with DescribeTableCommand
    await ddbClient.send(new DescribeTableCommand({ TableName: TABLE_NAME }));

    isMockMode = false;
    connectionStatus = 'connected_aws';
    statusMessage = `Connected to AWS DynamoDB (Table: ${TABLE_NAME}, Region: ${AWS_REGION})`;
    console.log(`[Storage] ✅ ${statusMessage}`);
  } catch (error) {
    isMockMode = true;
    connectionStatus = 'fallback_mock';

    let reason = error.name || 'AWS Error';
    if (error.name === 'ResourceNotFoundException') {
      reason = `Table "${TABLE_NAME}" does not exist in region "${AWS_REGION}"`;
    } else if (error.name === 'UnrecognizedClientException' || error.name === 'CredentialsProviderError') {
      reason = 'No valid AWS credentials or IAM role found';
    } else if (error.message) {
      reason = error.message;
    }

    statusMessage = `Running on Local Mock Data (AWS fallback: ${reason})`;
    console.warn(`[Storage] ⚠️ AWS DynamoDB unreachable (${reason}).`);
    console.warn(`[Storage] 🚀 Automatic Fallback: System initialized with in-memory mock data.`);
  }

  return getStatus();
}

/**
 * Get current system & DB status
 */
function getStatus() {
  return {
    mode: isMockMode ? 'mock' : 'dynamodb',
    isMock: isMockMode,
    status: connectionStatus,
    message: statusMessage,
    tableName: TABLE_NAME,
    region: AWS_REGION,
    totalRecords: isMockMode ? mockStudents.length : null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Fetch all students
 */
async function getAllStudents() {
  if (isMockMode) {
    // Return copy sorted by timestamp descending
    return [...mockStudents].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  try {
    const command = new ScanCommand({ TableName: TABLE_NAME });
    const response = await docClient.send(command);
    const items = response.Items || [];
    return items.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  } catch (error) {
    console.error('[Storage Error - Scan]', error);
    throw new Error(`Failed to fetch students from DynamoDB: ${error.message}`);
  }
}

/**
 * Get a single student by studentId
 */
async function getStudentById(studentId) {
  if (isMockMode) {
    return mockStudents.find((s) => s.studentId === studentId) || null;
  }

  try {
    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: { studentId },
    });
    const response = await docClient.send(command);
    return response.Item || null;
  } catch (error) {
    console.error('[Storage Error - GetItem]', error);
    throw new Error(`Failed to retrieve student: ${error.message}`);
  }
}

/**
 * Create a new student record
 */
async function createStudent({ studentId, name, course, email }) {
  if (!studentId || !name || !course || !email) {
    throw new Error('All fields (studentId, name, course, email) are required.');
  }

  const record = {
    studentId: String(studentId).trim(),
    name: String(name).trim(),
    course: String(course).trim(),
    email: String(email).trim().toLowerCase(),
    timestamp: new Date().toISOString(),
  };

  if (isMockMode) {
    const exists = mockStudents.some((s) => s.studentId.toLowerCase() === record.studentId.toLowerCase());
    if (exists) {
      throw new Error(`Student with ID "${record.studentId}" already exists.`);
    }
    mockStudents.unshift(record);
    return record;
  }

  try {
    // ConditionExpression prevents overwriting existing record with the same studentId
    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: record,
      ConditionExpression: 'attribute_not_exists(studentId)',
    });
    await docClient.send(command);
    return record;
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      throw new Error(`Student with ID "${record.studentId}" already exists in DynamoDB.`);
    }
    console.error('[Storage Error - PutItem]', error);
    throw new Error(`Failed to create student in DynamoDB: ${error.message}`);
  }
}

/**
 * Delete a student record by studentId
 */
async function deleteStudent(studentId) {
  if (!studentId) {
    throw new Error('Student ID is required for deletion.');
  }

  const id = String(studentId).trim();

  if (isMockMode) {
    const initialLength = mockStudents.length;
    mockStudents = mockStudents.filter((s) => s.studentId !== id);
    if (mockStudents.length === initialLength) {
      throw new Error(`Student with ID "${id}" not found.`);
    }
    return { success: true, studentId: id };
  }

  try {
    const command = new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { studentId: id },
    });
    await docClient.send(command);
    return { success: true, studentId: id };
  } catch (error) {
    console.error('[Storage Error - DeleteItem]', error);
    throw new Error(`Failed to delete student from DynamoDB: ${error.message}`);
  }
}

/**
 * Reset mock data to original demo set (useful in mock mode)
 */
function resetMockData() {
  mockStudents = JSON.parse(JSON.stringify(INITIAL_MOCK_STUDENTS));
  return mockStudents;
}

module.exports = {
  initDb,
  getStatus,
  getAllStudents,
  getStudentById,
  createStudent,
  deleteStudent,
  resetMockData,
};
