require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Redis = require("ioredis");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const proxy = require("express-http-proxy");

const logger = require("./utils/logger");
const errorHandler = require("./middleware/errorHandler");
const { validateToken } = require("./middleware/authMiddleware");

const app = express();
const port = process.env.PORT;

// redis client
const redisClient = new Redis(process.env.REDIS_URL);


// middlewares
app.use(cors());
app.use(helmet());
app.use(express.json());


// rate limiter
const rateLimitOptions = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`Sensitive endpoint rate limit exceeded for IP: ${req.ip}`)
        res.status(429).json({
            success: false,
            message: "Too many requests"
        });
    },
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
    }),
});

app.use(rateLimitOptions);


app.use((req, res, next) => {
    logger.info(`Received ${req.method} request to ${req.url}`)
    logger.info(`Request body, ${req.body}`)
    next();
});


// proxy options
const proxyOptions = {
    proxyReqPathResolver: (req) => {
        return req.originalUrl.replace(/^\/v1/, "/api");
    },
    proxyErrorHandler: (err, res, next) => {
        logger.error(`Proxy error: ${err.message}`);
        res.status(500).json({
            message: `Internal server error`,
            error: err.message
        });
    },
};

// setting up proxy for our identity service
app.use(
    "/v1/auth",
    proxy(process.env.IDENTITY_SERVICE_URL, {
        ...proxyOptions,
        proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
            proxyReqOpts.headers["Content-Type"] = "application/json";
            return proxyReqOpts;
        },
        userResDecorator: async (proxyRes, proxyResData, userReq, userRes) => {
            logger.info(`Response received from Identity Service: ${proxyRes.statusCode}`);
            return proxyResData;
        },
    })
);

// setting up proxy for our post service
app.use(
    "/v1/posts",
    validateToken,
    proxy(process.env.POST_SERVICE_URL, {
        ...proxyOptions,
        proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
            proxyReqOpts.headers["Content-Type"] = "application/json";
            proxyReqOpts.headers['x-user-id'] = srcReq.user.userId
            return proxyReqOpts
        },
        userResDecorator: async (proxyRes, proxyResData, userReq, userRes) => {
            logger.info(`Response received from Post Service: ${proxyRes.statusCode}`);
            return proxyResData;
        },
    })
);

// setting up proxy for our media service
app.use(
    "/v1/media",
    validateToken,
    proxy(process.env.MEDIA_SERVICE_URL, {
        ...proxyOptions,
        proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
            proxyReqOpts.headers['x-user-id'] = srcReq.user.userId;
            if (!srcReq.headers['content-type'].startsWith("multipart/form-data")) {
                proxyReqOpts.headers["Content-Type"] = "application/json";
            }
            return proxyReqOpts;
        },
        userResDecorator: async (proxyRes, proxyResData, userReq, userRes) => {
            logger.info(`Response received from Media Service: ${proxyRes.statusCode}`);
            return proxyResData;
        },
        parseReqBody: false
    })
);


// setting up proxy for our search service
app.use(
    "/v1/search",
    validateToken,
    proxy(process.env.SEARCH_SERVICE_URL, {
        ...proxyOptions,
        proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
            proxyReqOpts.headers["Content-Type"] = "application/json";
            proxyReqOpts.headers['x-user-id'] = srcReq.user.userId
            return proxyReqOpts
        },
        userResDecorator: async (proxyRes, proxyResData, userReq, userRes) => {
            logger.info(`Response received from Search Service: ${proxyRes.statusCode}`);
            return proxyResData;
        },
    })
);


// setting up proxy for our search service
app.use(
    "/v1/profile",
    validateToken,
    proxy(process.env.PROFILE_SERVICE_URL, {
        ...proxyOptions,
        proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
            proxyReqOpts.headers["Content-Type"] = "application/json";
            proxyReqOpts.headers['x-user-id'] = srcReq.user.userId
            return proxyReqOpts
        },
        userResDecorator: async (proxyRes, proxyResData, userReq, userRes) => {
            logger.info(`Response received from Profile Service: ${proxyRes.statusCode}`);
            return proxyResData;
        },
    })
);


// error handler
app.use(errorHandler);


app.listen(port, () => {
    logger.info(`API Gateway is running on port ${port}`);
    logger.info(`Identity service is running on port ${process.env.IDENTITY_SERVICE_URL}`);
    logger.info(`Post service is running on port ${process.env.POST_SERVICE_URL}`);
    logger.info(`Media service is running on port ${process.env.MEDIA_SERVICE_URL}`);
    logger.info(`Search service is running on port ${process.env.SEARCH_SERVICE_URL}`);
    logger.info(`Profile service is running on port ${process.env.PROFILE_SERVICE_URL}`);
    logger.info(`Redis url ${process.env.REDIS_URL}`);
});