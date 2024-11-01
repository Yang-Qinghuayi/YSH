import { realPx } from "./utils";

// 存放阅读器相关的数据
export const FONT_SIZE_LIST = [
  { fontSize: "14px" },
  { fontSize: "16px" },
  { fontSize: "18px" },
  { fontSize: "20px" },
  { fontSize: "22px" },
];

export const FONT_FAMILY_LIST = [
  { fontFamily: "Default" },
  { fontFamily: "Consolas" },
  { fontFamily: "Days One" },
  { fontFamily: "Montserrate" },
  { fontFamily: "Tangerina" },
];

export function themeList() {
  return [
    {
      alias: "默认",
      name: "Default",
      style: {
        body: {
          color: "#4c5059",
          background: "#cecece",
          // 控制ebook上下的空间，用来显示页眉页脚
          "padding-top": `${realPx(30)}px!important`,
          "padding-bottom": `${realPx(30)}px!important`,
        },
      },
    },
    {
      alias: "雅致",
      name: "Gold",
      style: {
        body: {
          color: "#5c5b56",
          background: "#c6c2b6",
          "padding-top": `${realPx(30)}px!important`,
          "padding-bottom": `${realPx(30)}px!important`,
        },
      },
    },
    {
      alias: "护眼",
      name: "Eye",
      style: {
        body: {
          color: "#404c42",
          background: "#a9c1a9",
          "padding-top": `${realPx(30)}px!important`,
          "padding-bottom": `${realPx(30)}px!important`,
        },
      },
    },
    {
      alias: "夜晚",
      name: "Night",
      style: {
        body: {
          color: "#cecece",
          background: "#000000",
          "padding-top": `${realPx(30)}px!important`,
          "padding-bottom": `${realPx(30)}px!important`,
        },
      },
    },
  ];
}
