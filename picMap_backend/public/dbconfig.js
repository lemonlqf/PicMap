const mysql = require('mysql2')

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'pic_map'
})

const executeQuery = (sql, values) => {
  return new Promise((resolve, reject) => {
    pool.getConnection((error, connection) => {
      if (error) {
        reject(error)
        return
      }
      connection.query(sql, values, (err, results) => {
        if (err) {
          reject(err)
          return
        }
        resolve(results)
        connection.release()
      })
    })
  })
}

module.exports = {
  executeQuery,
  pool
}
