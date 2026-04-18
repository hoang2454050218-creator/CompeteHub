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
      '/auth/verify-email': {
        post: {
          tags: ['Auth'],
          summary: 'Verify email with token',
          requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } } } } },
          responses: { '200': { description: 'Email verified' } },
        },
      },
      '/auth/resend-verification': {
        post: {
          tags: ['Auth'],
          summary: 'Resend email verification link (rate limited)',
          requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } } } },
          responses: { '200': { description: 'Sent if user exists and not verified' } },
        },
      },
      '/auth/mfa/setup': {
        post: {
          tags: ['Auth', 'MFA'],
          summary: 'Begin TOTP MFA setup, returns QR code data URL',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Returns secret + qrDataUrl' } },
        },
      },
      '/auth/mfa/enable': {
        post: {
          tags: ['Auth', 'MFA'],
          summary: 'Confirm TOTP code and enable MFA, returns backup codes',
          security: [{ bearerAuth: [] }],
          requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['code'], properties: { code: { type: 'string' } } } } } },
          responses: { '200': { description: 'MFA enabled, backup codes returned (one-time)' } },
        },
      },
      '/auth/mfa/disable': {
        post: {
          tags: ['Auth', 'MFA'],
          summary: 'Disable MFA (requires password)',
          security: [{ bearerAuth: [] }],
          requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['password'], properties: { password: { type: 'string' } } } } } },
          responses: { '200': { description: 'MFA disabled' } },
        },
      },
      '/auth/login/mfa': {
        post: {
          tags: ['Auth', 'MFA'],
          summary: 'Complete login by submitting TOTP / backup code',
          requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['mfaToken','code'], properties: { mfaToken: { type: 'string' }, code: { type: 'string' } } } } } },
          responses: { '200': { description: 'Login successful' } },
        },
      },
      '/users/me/export': {
        get: {
          tags: ['User', 'GDPR'],
          summary: 'Export all data tied to current account as JSON',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'JSON export download' } },
        },
      },
      '/users/me': {
        delete: {
          tags: ['User', 'GDPR'],
          summary: 'Anonymize and deactivate current account (requires password + DELETE confirm)',
          security: [{ bearerAuth: [] }],
          requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['password','confirm'], properties: { password: { type: 'string' }, confirm: { type: 'string', enum: ['DELETE'] } } } } } },
          responses: { '200': { description: 'Account anonymized' } },
        },
      },
      '/users/me/notification-preferences': {
        put: {
          tags: ['User'],
          summary: 'Update notification preferences map',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Saved' } },
        },
      },
      '/users/{id}/follow': {
        post: { tags: ['Follow'], summary: 'Follow a user', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Followed' } } },
        delete: { tags: ['Follow'], summary: 'Unfollow a user', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Unfollowed' } } },
      },
      '/users/{id}/followers': {
        get: { tags: ['Follow'], summary: 'List followers of a user', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'List' } } },
      },
      '/users/{id}/following': {
        get: { tags: ['Follow'], summary: 'List users that a user follows', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'List' } } },
      },
      '/badges': {
        get: { tags: ['Badges'], summary: 'List all available badges', responses: { '200': { description: 'List of badges' } } },
      },
      '/badges/users/{id}': {
        get: { tags: ['Badges'], summary: 'List badges a user has earned', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'List' } } },
      },
      '/admin/audit-logs': {
        get: { tags: ['Admin'], summary: 'Paginated audit log (admin only)', security: [{ bearerAuth: [] }], responses: { '200': { description: 'List of audit log entries' } } },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
