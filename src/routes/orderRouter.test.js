const {createAdmin, expectValidJwt, createFranchise, createStore} = require("./testUtils.js");

const request = require('supertest');
const app = require('../service');

let adminUser;
let adminUserAuthToken;

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };

let testUserAuthToken;

beforeAll(async () => {
    testUser.email = Math.random().toString(36).substring(2,12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    expectValidJwt(testUserAuthToken);

    adminUser = await createAdmin();
    const adminLoginRes = await request(app).put('/api/auth').send(adminUser);
    expect(adminLoginRes.status).toBe(200);
    expectValidJwt(adminLoginRes.body.token);
    adminUserAuthToken = adminLoginRes.body.token;
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

test('createMenuItem and getMenu', async () => {
    const {testMenuItemObject} = await createMenuItem();
    const getMenuRes = await request(app).get('/api/order/menu');
    expect(getMenuRes.status).toBe(200);
    expect(getMenuRes.body.at(-1)).toMatchObject(testMenuItemObject);
});

test('createOrder and getOrders', async () => {
    const {newFranchiseRes} = await createFranchise(adminUserAuthToken, adminUser.email);
    expect(newFranchiseRes.status).toBe(200);
    const {createStoreRes} = await createStore(newFranchiseRes.body.id, adminUserAuthToken);
    expect(createStoreRes.status).toBe(200);

    const {createMenuItemRes} = await createMenuItem();
    expect(createMenuItemRes.status).toBe(200);

    const createOrderRes = await request(app).post('/api/order')
        .set({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${testUserAuthToken}`
        }).send(
            {
                'franchiseId': newFranchiseRes.body.id,
                'storeId': createStoreRes.body.id,
                'items': [
                    {
                        'menuId': createMenuItemRes.body.at(-1).id,
                        'description': createMenuItemRes.body.at(-1).description,
                        'price': createMenuItemRes.body.at(-1).price
                    }
                ]  
            }
        );

    expect(createOrderRes.status).toBe(200);
    expectValidJwt(createOrderRes.body.jwt);
    const getOrdersRes = await request(app).get('/api/order')
        .set({'Authorization': `Bearer ${testUserAuthToken}`});
    
    expect(getOrdersRes.status).toBe(200);
    expect(getOrdersRes.body.orders.at(-1)).toMatchObject(createOrderRes.body.order)
});


// { dinerId: 4, orders: [{ id: 1, franchiseId: 1, storeId: 1, date: '2024-06-05T05:14:40.000Z', items: [{ id: 1, menuId: 1, description: 'Veggie', price: 0.05 }] }], page: 1 },