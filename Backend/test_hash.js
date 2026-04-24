const bcrypt = require('bcryptjs');
const passwordGo = '123'; // Mật khẩu bạn muốn mã hóa
bcrypt.hash(passwordGo, 10, (err, hash) => {
    if (err) console.error(err);
    console.log("Chuỗi mã hóa của bạn đây Nhi ơi:");
    console.log(hash);
});