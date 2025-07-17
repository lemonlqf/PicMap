/*
 * @Author: Do not edit
 * @Date: 2025-02-06 11:44:34
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-17 21:32:14
 * @FilePath: \Code\picMap_fontend\src\components\drawer\imageInfo.ts
 * @Description:
 */
import { useI18n } from 'vue-i18n'

export const getLabels = (key: string) => {
  const { t } = useI18n()
  const map: any = {
    GPSLatitude: t('latitude'),
    GPSLongitude: t('longitude'),
    GPSAltitude: t('altitude'),
    DateTime: t('dateTime'),
    Arits: t('arits'),
    SoftWare: t('softWare'),
    Make: t('make'),
    Model: t('model'),
    FNumber: t('fNumber'),
    ExposureTime: t('exposureTime'),
    ISOSpeedRatings: t('ISOSpeedRatings'),
    ExposureBiasValue: t('exposureBiasValue'),
    FocalLength: t('focalLength'),
    MaxApertureValue: t('maxApertureValue'),
    Resolution: t('resolution'),
    BrightnessValue: t('brightnessValue'),
    size: t('size')
  }
  return map[key]
}

export const showIndicators = [
  'GPSLatitude',
  'GPSLongitude',
  'GPSAltitude',
  'DateTime',
  'Arits',
  // 'SoftWare',
  'Make',
  'Model',
  'FNumber',
  'ExposureTime',
  'ISOSpeedRatings',
  'ExposureBiasValue',
  'FocalLength',
  'MaxApertureValue',
  'Resolution',
  'size'
]
