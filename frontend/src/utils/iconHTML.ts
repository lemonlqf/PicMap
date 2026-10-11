/*
 * @Author: your name
 * @Date: 2025-09-11 19:34:56
 * @LastEditTime: 2025-09-13 18:24:54
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @Description: In User Settings Edit
 * @FilePath: \Code\picMap_fontend\src\utils\icon.ts
 */
import { imageMarkerTranslateY, MARKER_CONSTANT } from "./constant";

export enum IconType {
  NoImage = "noImage",
  SingleImage = "singleImage",
  MultiImage = "multiImage",
  NoImageGroup = "noImageGroup",
}

type IconCreateMap = {
  [IconType.NoImage]: (text: string) => HTMLElement;
  [IconType.SingleImage]: (imgUrl: string) => HTMLElement;
  [IconType.MultiImage]: (imgUrls: string[], totalCount: number) => HTMLElement;
  [IconType.NoImageGroup]: (text: string) => HTMLElement;
};

// 图标HTML工厂类
export default class IconHTMLFactory {
  private static createIconMap: IconCreateMap = {
    [IconType.NoImage]: this.createNoImageIcon,
    [IconType.SingleImage]: this.createSingleImageIcon,
    [IconType.MultiImage]: this.createMultiImageIcon,
    [IconType.NoImageGroup]: this.createNoGroupIcon,
  };

  // 创建图标的工厂方法
  static createIcon<T extends IconType>(
    type: T,
    ...args: Parameters<IconCreateMap[T]>
  ) {
    return (this.createIconMap[type] as Function)(...args);
  }

  // 创建没有图片的图标
  static createNoImageIcon(text: string) {
    const locationDiv = document.createElement("div");
    locationDiv.className = "location";
    const div = document.createElement("div");
    div.className = "image-icon";
    div.style.lineHeight = imageMarkerTranslateY + "px";
    div.innerHTML = text;
    div.appendChild(locationDiv);
    return div;
  }

  // 创建单张图片的图标
  static createSingleImageIcon(imgUrl: string) {
    const locationDiv = document.createElement("div");
    locationDiv.className = "location";
    const div = document.createElement("div");
    div.appendChild(locationDiv);
    const img = document.createElement("img") as HTMLImageElement;
    img.width = MARKER_CONSTANT.IMAGE_MARKER_SIZE[0];
    img.height = imageMarkerTranslateY;
    img.src = imgUrl;
    div.className = "image-icon";
    div.appendChild(img);
    return div;
  }

  // 创建多张图片的图标
  static createMultiImageIcon(imgUrls: string[], totalCount: number = 0) {
    if (!imgUrls || imgUrls.length === 0) {
      return this.createNoGroupIcon("暂无图片");
    }
    const locationDiv = document.createElement("div");
    locationDiv.className = "location group-location";
    const div = document.createElement("div");
    div.appendChild(locationDiv);
    for (let i = 0; i < imgUrls.length; i++) {
      const img = document.createElement("img") as HTMLImageElement;
      img.width = MARKER_CONSTANT.GROUP_MARKER_SIZE[0] / 2;
      img.height = MARKER_CONSTANT.GROUP_MARKER_SIZE[1] / 2;
      img.src = imgUrls[i];
      div.className = "image-icon";
      div.appendChild(img);
    }
    if (totalCount > 0) {
      const badge = document.createElement("div");
      badge.className = "group-count-badge";
      badge.textContent = totalCount > 99 ? '99+' : String(totalCount);
      div.appendChild(badge);
    }
    return div;
  }

  // 创建没有图片的分组图标
  static createNoGroupIcon(text: string) {
    const div = IconHTMLFactory.createNoImageIcon(text);
    // 定位点添加一个类分组的类名
    div.children[0].classList.add("group-location");
    return div;
  }
}
