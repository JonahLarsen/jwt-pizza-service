const {expectValidJwt, randomName} = require("./testUtils.js");

const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };

let testUserAuthToken;
let testUserId;

beforeAll(async () => {
    testUser.email = Math.random().toString(36).substring(2,12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    testUserId = registerRes.body.user.id;
    expectValidJwt(testUserAuthToken);
});


test('getUser', async () => {
    const getUserRes = await request(app).get('/api/user/me').set({
        'Authorization': `Bearer ${testUserAuthToken}`
    });

    expect(getUserRes.status).toBe(200);
    expect(getUserRes.body.name).toBe(testUser.name);
});


test('updateUser', async () => {
    const newUsername = randomName();
    const newUserEmail = newUsername + `@test.com`
    const updateUserRes = await request(app).put(`/api/user/${testUserId}`)
    .set({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testUserAuthToken}`
    })
    .send({
        name: newUsername,
        email: newUserEmail,
        password: "newsecretpassword"
    });
    expect(updateUserRes.status).toBe(200);
    expect(updateUserRes.body.user.id).toBe(testUserId);
    expect(updateUserRes.body.user.name).toBe(newUsername);
});

test('list users unauthorized', async () => {
  const listUsersRes = await request(app).get('/api/user');
  expect(listUsersRes.status).toBe(401);
});

test('list users', async () => {
  const [user, userToken] = await registerUser(request(app));
  const listUsersRes = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + userToken);
  expect(listUsersRes.status).toBe(200);
});

async function registerUser(service) {
  const testUser = {
    name: 'pizza diner',
    email: `${randomName()}@test.com`,
    password: 'a',
  };
  const registerRes = await service.post('/api/auth').send(testUser);
  registerRes.body.user.password = testUser.password;

  return [registerRes.body.user, registerRes.body.token];
}


