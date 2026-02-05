const {createAdmin, expectValidJwt, createFranchise, createStore} = require("./testUtils.js");

const request = require('supertest');
const app = require('../service');

let adminUser;
let adminUserAuthToken;

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };

let testUserAuthToken;
let testUserId;

beforeAll(async () => {
    testUser.email = Math.random().toString(36).substring(2,12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    testUserId = registerRes.body.user.id;
    expectValidJwt(testUserAuthToken);

    adminUser = await createAdmin();
    const adminLoginRes = await request(app).put('/api/auth').send(adminUser);
    expect(adminLoginRes.status).toBe(200);
    expectValidJwt(adminLoginRes.body.token);
    adminUserAuthToken = adminLoginRes.body.token;
});


test('getUser', async () => {
    const getUserRes = await request(app).get('/api/user/me').set({
        'Authorization': `Bearer ${testUserAuthToken}`
    });

    expect(getUserRes.status).toBe(200);
    expect(getUserRes.body.name).toBe(testUser.name);
});


test('updateUser', async () => {
    const updateUserRes = await request(app).put(`/api/user/${testUserId}`)
    .set({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testUserAuthToken}`
    })
    .send({
        name: "newTestUserName",
        email: "newTestUserEmail@test.com",
        password: "newsecretpassword"
    });
    expect(updateUserRes.status).toBe(200);
    expect(updateUserRes.body.user.id).not.toBe(testUserId);
    expect(updateUserRes.body.user.name).toBe("newTestUserName");
})


