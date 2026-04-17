import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Competition Platform API',
      version: '1.0.0',
      description: 'Online Competition Platform REST API',
    },
    servers: [
      { url: '/api/v1', description: 'API v1' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            avatarUrl: { type: 'string' },
            role: { type: 'string', enum: ['ADMIN', 'HOST', 'PARTICIPANT'] },
          },
        },
        Competition: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'COMPLETED', 'ARCHIVED'] },
            category: { type: 'string', enum: ['FEATURED', 'GETTING_STARTED', 'RESEARCH', 'COMMUNITY'] },
            evalMetric: { type: 'string', enum: ['ACCURACY', 'RMSE', 'F1_SCORE', 'AUC_ROC', 'LOG_LOSS', 'CUSTOM'] },
            tags: { type: 'array', items: { type: 'string' } },
            prize: { type: 'string' },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
          },
        },
        Submission: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['QUEUED', 'SCORING', 'SCORED', 'FAILED'] },
            publicScore: { type: 'number' },
            privateScore: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            message: { type: 'string' },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
              },
            },
          },
        },
      },
    },
    paths: {
      '/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register a new user',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password', 'name'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                    name: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'User created' } },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login with email and password',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string' },
                    password: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Login successful' } },
        },
      },
      '/competitions': {
        get: {
          tags: ['Competitions'],
          summary: 'List competitions',
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string' } },
            { name: 'category', in: 'query', schema: { type: 'string' } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'sort', in: 'query', schema: { type: 'string', default: 'newest' } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 12 } },
          ],
          responses: { '200': { description: 'Competition list' } },
        },
        post: {
          tags: ['Competitions'],
          summary: 'Create a competition',
          security: [{ bearerAuth: [] }],
          responses: { '201': { description: 'Competition created' } },
        },
      },
      '/competitions/{id}/submissions': {
        post: {
          tags: ['Submissions'],
          summary: 'Submit a prediction file',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, description: { type: 'string' } } } } },
          },
          responses: { '202': { description: 'Submission accepted' } },
        },
      },
      '/competitions/{id}/leaderboard': {
        get: {
          tags: ['Leaderboard'],
          summary: 'Get public leaderboard',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Leaderboard entries' } },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
