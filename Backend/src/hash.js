const bcrypt = require('bcryptjs');

async function generateHash() {
    const pass = "123456";
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(pass, salt);
    console.log("-------------------------------------------");
    console.log("CHUỖI MÃ HÓA CỦA NHI ĐÂY:");
    console.log(hash); // Đây là cái Nhi cần copy
    console.log("-------------------------------------------");
}

generateHash(); // Dòng