const os = require('os');
const config = require('./config.js')

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
    total: [],
    GET: [],
    POST: [],
    PUT: [],
    DELETE: [],
};

const activeUsers = new Map();


function requestTracker(req, res, next) {
    const method = req.method;
    const now = Date.now();

    requestCounts.total.push(now);
    if (method in requestCounts) {
        requestCounts[method].push(now);
    }

    if (req.user) {
        activeUsers.set(req.user.id, now);
    }

    next();
}

//This should be sending each type of request per minute and then resetting
setInterval(() => {
    const oneMinuteAgo = Date.now() - 60 * 1000;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    Object.keys(requestCounts).forEach((key) => {
        requestCounts[key] = requestCounts[key].filter(ts => ts > oneMinuteAgo);
    });

    const metrics = [
        createMetric('requests_per_minute', requestCounts.total.length, '1', 'sum', 'asInt', { method: 'total'}),
        createMetric('requests_per_minute', requestCounts.GET.length, '1', 'sum', 'asInt', { method: 'GET' }),
        createMetric('requests_per_minute', requestCounts.POST.length, '1', 'sum', 'asInt', { method: 'POST' }),
        createMetric('requests_per_minute', requestCounts.PUT.length, '1', 'sum', 'asInt', { method: 'PUT' }),
        createMetric('requests_per_minute', requestCounts.DELETE.length, '1', 'sum', 'asInt', { method: 'DELETE' }),
        createMetric('active_users', activeCount, '1', 'sum', 'asInt', {}),
    ]
    sendMetricToGrafana(metrics);

}, 10000);

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
}