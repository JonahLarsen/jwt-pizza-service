const {createAdmin, expectValidJwt, randomName} = require("./testUtils.js");

const request = require('supertest');
const app = require('../service');

let adminUser;
let adminUserAuthToken;
let adminUserId;

beforeAll(async () => {
    adminUser = await createAdmin();
    const adminLoginRes = await request(app).put('/api/auth').send(adminUser);
    expect(adminLoginRes.status).toBe(200);
    expectValidJwt(adminLoginRes.body.token);
    adminUserAuthToken = adminLoginRes.body.token;
    adminUserId = adminLoginRes.body.user.id;
})

async function createMenuItem() {
    const testMenuItemObject = {
            'title': "testMenuItem",
            'description': 'a pizza full of yummy test data',
            'image': 'fakepizzaimage.png',
            'price': 1.55
        }
    const createMenuItemRes = await request(app).put('/api/order/menu').set(
        {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${adminUserAuthToken}`
        }
    )
    .send(testMenuItemObject)
    expect(createMenuItemRes.status).toBe(200);
    expect(createMenuItemRes.body.at(-1)).toMatchObject(testMenuItemObject);

    return {
        createMenuItemRes: createMenuItemRes,
        testMenuItemObject: testMenuItemObject
    }
}

test('getMenu', async () => {
    const {createMenuItemRes, testMenuItemObject} = await createMenuItem();
    const getMenuRes = await request(app).get('/api/order/menu');
    expect(getMenuRes.status).toBe(200);
    expect(getMenuRes.body.at(-1)).toMatchObject(testMenuItemObject);
})