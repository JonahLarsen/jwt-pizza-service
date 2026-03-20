const os = require('os');
const config = require('./config.js');

function getCpuUsagePercentage() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;
    return memoryUsage.toFixed(2);
}


const requestCounts = {
    total: 0,
    GET: 0,
    POST: 0,
    PUT: 0,
    DELETE: 0,
};

const activeUsers = new Map();

const authTimestamps = {
    success: 0,
    fail: 0
}

const pizzaPurchases = {
    success: 0,
    fail: 0
}

let revenue = 0;
let factoryLatency = 0
let serviceLatency = 0;

function requestTracker(req, res, next) {
    const method = req.method;
    const now = Date.now();

    requestCounts.total += 1;
    if (method in requestCounts) {
        requestCounts[method] += 1;
    }

    if (req.user) {
        activeUsers.set(req.user.id, now);
    }

    const start = Date.now();
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        serviceLatency = Date.now() - start;
        return originalJson(body);
    };

    if (req.path.startsWith('/api/auth') && (method === 'PUT' || method === 'POST')) {
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            serviceLatency = Date.now() - start;
            if (res.statusCode >= 200 && res.statusCode < 300) {
                authTimestamps.success += 1;
            } else {
                authTimestamps.fail += 1;
            }
            return originalJson(body);
        };
    }

    if (req.path.startsWith('/api/order') && (method === 'POST')) {
        const originalJson  = res.json.bind(res);
        res.json = (body) => {
            serviceLatency = Date.now() - start;
            try {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    pizzaPurchases.success += 1;
                    if (body.order?.items) {
                        revenue += body.order.items.reduce((sum, item) => sum + item.price, 0);
                    }
                } else {
                    pizzaPurchases.fail += 1;
                }
            } catch (err) {
                console.error(err);
            }            
            return originalJson(body);
        };
    }

    next();
}

//This should be sending each type of request per minute and then resetting
setInterval(() => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    const activeCount = [...activeUsers.values()].filter(ts => ts > fiveMinutesAgo).length;

    const metrics = [
        createMetric('requests_per_minute', requestCounts.total, '1', 'sum', 'asInt', { method: 'total'}),
        createMetric('requests_per_minute', requestCounts.GET, '1', 'sum', 'asInt', { method: 'GET' }),
        createMetric('requests_per_minute', requestCounts.POST, '1', 'sum', 'asInt', { method: 'POST' }),
        createMetric('requests_per_minute', requestCounts.PUT, '1', 'sum', 'asInt', { method: 'PUT' }),
        createMetric('requests_per_minute', requestCounts.DELETE, '1', 'sum', 'asInt', { method: 'DELETE' }),
        createMetric('active_users', activeCount, '1', 'gauge', 'asInt', {}),
        createMetric('auth_requests_per_minute', authTimestamps.success, '1', 'sum', 'asInt', { result: 'success'}),
        createMetric('auth_requests_per_minute', authTimestamps.fail, '1', 'sum', 'asInt', { result: 'fail'}),
        createMetric('cpu_percent', getCpuUsagePercentage(), '%', 'gauge', 'asDouble', {}),
        createMetric('memory_percent', getMemoryUsagePercentage(), '%', 'gauge', 'asDouble', {}),
        createMetric('pizzas_sold_per_minute', pizzaPurchases.success, '1', 'sum', 'asInt', { result: 'success'}),
        createMetric('pizzas_sold_per_minute', pizzaPurchases.fail, '1', 'sum', 'asInt', { result: 'fail' }),
        createMetric('revenue', revenue, 'BTC', 'sum', 'asDouble', {}),

    ]
    sendMetricToGrafana(metrics);

}, 10000);

function setFactoryLatency(latency) {
    factoryLatency = latency;
}

setInterval(() => {
    const metrics = [
        createMetric('server_latency', serviceLatency, 'ms', 'gauge', 'asInt', {}),
        createMetric("factory_latency", factoryLatency, 'ms', 'gauge', 'asInt', {})
    ]
    sendMetricToGrafana(metrics);
}, 1000)

function createMetric(metricName, metricValue, metricUnit, metricType, valueType, attributes) {
    attributes = { ...attributes, source: config.metrics.source};

    const metric = {
        name: metricName,
        unit: metricUnit,
        [metricType]: {
            dataPoints: [
                {
                    [valueType]: metricValue,
                    timeUnixNano: Date.now() * 1000000,
                    attributes: [],
                },
            ],
        },
    };

    Object.keys(attributes).forEach((key) => {
        metric[metricType].dataPoints[0].attributes.push({
            key: key,
            value: { stringValue: attributes[key] },
        });
    });

    if (metricType === 'sum') {
        metric[metricType].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
        metric[metricType].isMonotonix = true;
    }

    return metric;
}

function sendMetricToGrafana(metrics) {
    const body = {
        resourceMetrics: [
            {
                scopeMetrics: [
                    {
                        metrics,
                    },
                ],
            },
        ],
    };

    fetch(`${config.metrics.endpointUrl}`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`, 'Content-Type': 'application/json' },
    })
        .then(async (response) => {
            if (!response.ok) {
                const text = await response.text();
                console.error(text);
                throw new Error(`HTTP status: ${response.status}`);
            }
        })
        .catch((error) => {
            console.error('Error pushing metrics:', error);
        });
}

module.exports = {
    getCpuUsagePercentage,
    getMemoryUsagePercentage,
    requestTracker,
    sendMetricToGrafana,
    createMetric,
    setFactoryLatency
}