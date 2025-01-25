const ResultCode = require('./baseResultcode')
/**
 * @author ycx
 * @description 统一返回结果
 */
class Result {
  /**
   * 返回code
   */
  code
  /**
   * 返回消息
   */
  msg
  /**
   * 返回数据
   */
  data
  /**
   * 返回时间
   */
  time

  /**
   *
   * @param code {number} 返回code
   * @param msg {string} 返回消息
   * @param data {any} 返回具体对象
   */
  constructor(code, msg, data) {
    this.code = code
    this.msg = msg
    this.data = data
    this.time = Date.now()
  }

  /**
   * 成功
   * @param data {any} 返回对象
   * @return {Result}
   */
  static success(data) {
    return new Result(ResultCode.SUCCESS.code, ResultCode.SUCCESS.desc, data)
  }

  /**
   * 失败
   */
  static fail(errData) {
    return new Result(ResultCode.FAILED.code, ResultCode.FAILED.desc, errData)
  }

  /**
   * 参数校验失败
   */
  static validateFailed(param) {
    return new Result(ResultCode.VALIDATE_FAILED.code, ResultCode.VALIDATE_FAILED.desc, param)
  }

  /**
   * 拦截到的业务异常
   * @param bizException {BizException} 业务异常
   */
  static bizFail(bizException) {
    return new Result(bizException.code, bizException.msg, null)
  }
}
module.exports = Result
