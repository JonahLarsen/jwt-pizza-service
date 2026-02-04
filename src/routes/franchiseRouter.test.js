const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };

let testUserAuthToken;
let testUserId

beforeAll(async () => {
    testUser.email = Math.random().toString(36).substring(2,12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    testUserId = registerRes.body.user.id
    expectValidJwt(testUserAuthToken);
});

test('getUserFranchises', async () => {
    const getFranchisesRes = await request(app).get(`/api/franchise/${testUserId}`).set({'Authorization': `Bearer ${testUserAuthToken}`});
    expect(getFranchisesRes.body).toMatchObject([]);

    let adminUser = createAdmin();

});

function createFranchise() {
    
}

function expectValidJwt(potentialJwt) {
    expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

async function createAdmin() {
    let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = user.name + '@admin.com'

    user = await DB.addUser(user);
    return { ...user, password: 'toomanysecrets' };
}