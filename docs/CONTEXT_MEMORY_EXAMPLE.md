# Example Session with MCP Context Memory

## Initial Setup

**Human:** I'm working on my-awesome-api. Please use the MCP Context Memory to track our work.

**Assistant:** I'll help you track your work on my-awesome-api using the MCP Context Memory. Let me start by setting up the project context.

```
store_project_context:
  project_name: "my-awesome-api"
  description: "RESTful API for task management with authentication"
  repository_url: "https://github.com/user/my-awesome-api"
  local_directory: "/Users/user/projects/my-awesome-api"
  status: "active"
  tags: ["api", "nodejs", "express", "mongodb"]
  metadata: {
    "language": "javascript",
    "framework": "express",
    "database": "mongodb",
    "auth": "jwt"
  }
```

✅ Project 'my-awesome-api' created successfully!

What aspects of the API are we working on today?

**Human:** I need to implement user authentication with JWT tokens.

**Assistant:** I'll help you implement JWT authentication. Let me document this decision and then we can start coding.

```
store_context:
  project_name: "my-awesome-api"
  type: "decision"
  key: "auth-jwt-implementation"
  value: "Implementing JWT-based authentication for the API. Tokens will be issued on login, expire after 24 hours, and include user ID and role. Using jsonwebtoken library. Refresh tokens will be implemented in phase 2."
  tags: ["authentication", "security", "jwt"]
```

✅ Stored decision context: "auth-jwt-implementation"

Now, let me help you implement the authentication. Here's a pattern we can use:

```javascript
// auth.middleware.js
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

Let me store this pattern for reuse:

```
store_context:
  project_name: "my-awesome-api"
  type: "code"
  key: "jwt-auth-middleware"
  value: "JWT authentication middleware that extracts and verifies Bearer tokens from Authorization header. Sets userId and userRole on request object. Returns 401 if token missing or invalid."
  tags: ["middleware", "authentication", "reusable"]
  metadata: {
    "filename": "auth.middleware.js",
    "dependencies": ["jsonwebtoken"]
  }
```

**Human:** Great! I implemented it but getting an error: "TypeError: Cannot read property 'replace' of undefined"

**Assistant:** Let me document this issue and help you fix it.

```
store_context:
  project_name: "my-awesome-api"
  type: "issue"
  key: "auth-header-undefined-error"
  value: "TypeError when Authorization header is missing. The optional chaining (?.) might not be supported in the current Node version. Need to add explicit undefined check."
  tags: ["bug", "authentication", "fixed"]
```

Here's the fixed version:

```javascript
const token = req.header('Authorization') 
  ? req.header('Authorization').replace('Bearer ', '')
  : null;
```

**Human:** That worked! Let's wrap up this session.

**Assistant:** Great! Let me document what we accomplished and set up next steps.

```
update_project_status:
  project_name: "my-awesome-api"
  status: "active"
  note: "Implemented JWT authentication middleware with error handling"
```

```
store_context:
  project_name: "my-awesome-api"
  type: "status"
  key: "session-2024-12-23-progress"
  value: "Completed: JWT authentication middleware implementation with proper error handling. Fixed undefined Authorization header bug. Stored reusable auth pattern."
  tags: ["progress", "session", "authentication"]
```

```
store_context:
  project_name: "my-awesome-api"
  type: "todo"
  key: "next-session-auth-tasks"
  value: "1. Implement user login endpoint that generates JWT tokens. 2. Add refresh token support. 3. Create user registration endpoint with password hashing. 4. Add role-based access control (RBAC) middleware. 5. Write tests for authentication flow."
  tags: ["todo", "authentication", "next-session"]
```

## Session Summary

✅ **Completed Today:**
- Set up project tracking for my-awesome-api
- Documented JWT authentication decision
- Implemented authentication middleware
- Fixed Authorization header bug
- Created reusable auth pattern

📝 **Key Decisions Stored:**
- JWT tokens with 24-hour expiry
- User ID and role included in tokens
- Refresh tokens planned for phase 2

🔧 **Code Patterns Saved:**
- JWT authentication middleware

🐛 **Issues Resolved:**
- Authorization header undefined error

📋 **Next Steps:**
1. Login endpoint with JWT generation
2. Refresh token support
3. User registration with bcrypt
4. RBAC middleware
5. Authentication tests

The context is now saved and will persist across sessions. When you return, just ask to see the project context for my-awesome-api!