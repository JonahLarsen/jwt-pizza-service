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
    total: 0,
    GET: 0,
    POST: 0,
    PUT: 0,
    DELETE: 0,
};

function requestTracker(req, res, next) {
    const method = req.method;
    requestCounts.total += 1;
    if (method in requestCounts) {
        requestCounts[method] += 1;
    }
    next();
}

//This should be sending each type of request per minute and then resetting
setInterval(() => {
    const metrics = [
        createMetric('requests_per_minute', requestCounts.total, '1', 'sum', 'asInt', { method: 'total'}),
        createMetric('requests_per_minute', requestCounts.GET, '1', 'sum', 'asInt', { method: 'GET' }),
        createMetric('requests_per_minute', requestCounts.POST, '1', 'sum', 'asInt', { method: 'POST' }),
        createMetric('requests_per_minute', requestCounts.PUT, '1', 'sum', 'asInt', { method: 'PUT' }),
        createMetric('requests_per_minute', requestCounts.DELETE, '1', 'sum', 'asInt', { method: 'DELETE' }),
    ]
    sendMetricToGrafana(metrics);

    Object.keys(requestCounts).forEach((key) => (requestCounts[key] = 0));

}, 60000);

function createMetric(metricName, metricValue, metricUnit, metricType, valueType, attributes) {
    attributes = { ...attributes, source: config.source};

    const metric = {
        name: metricName,
        unit: metricUnit,
        [metricType]: {
            dataPoints: [
                {
                    [valueType]: metricValue,
                    timeUnixNano: Date.now() * 100000,
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

    fetch(`${config.endpointUrl}`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { Authorization: `Bearer ${config.accountId}:${config.apiKey}`, 'Content-Type': 'application/json' },
    })
        .then((response) => {
            if (!response.ok) {
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