import React, { useState } from "react";
import pptxgen from "pptxgenjs";

const PPT: React.FC = () => {
  const [title, setTitle] = useState("");

  const generatePpt = () => {
    const _P = {
      NAME: "MatePlus",
      FONT_FACE: "돋움",
      UNIT: "px",
    };

    const size = (n: number) => n / (_P.UNIT === "px" ? 96 : 1);
    const _S = {
      WIDTH: size(1123),
      HEIGHT: size(794),
      PX: size(1),
      M1: size(24),
      M2: size(40),
      M3: size(80),
      FONT: { SIZE: { S: 12, M: 14, L: 20 } },
      COLOR: { BLACK: "000000", GM: "1E2061" },
    };

    let pptx = new pptxgen();
    pptx.defineLayout({ name: _P.NAME, width: _S.WIDTH, height: _S.HEIGHT });
    pptx.layout = _P.NAME;
    pptx.theme = { headFontFace: _P.FONT_FACE, bodyFontFace: _P.FONT_FACE };
    // pptx.author = "이창재";
    // pptx.company = "젠스타메이트";
    // pptx.revision = "1";
    // pptx.subject = "포켓몬스터";
    // pptx.title = "포켓몬스터 극장판: 너로 정했다!";

    const _E = {
      _1: {
        Y: _S.M2 + _S.M3 + _S.M1,
        W: (_S.WIDTH - (_S.M2 + _S.M1) * 2) / 3,
        H: [_S.M1, _S.PX, 200 * _S.PX],
      },
      _2: {
        X: _S.M2,
        Y: _S.M2 + _S.M3 + _S.M1 + _S.M1 + 210 * _S.PX,
      },
    };

    let slide = pptx.addSlide();

    slide.addText(
      [
        {
          text: title,
          options: {
            color: _S.COLOR.GM,
            fontSize: _S.FONT.SIZE.L,
            margin: 0,
          },
        },
      ],
      {
        x: _S.M1,
        y: _S.M1,
        w: _S.WIDTH - _S.M2 * 2,
        h: _S.M3,
      }
    );

    [
      ["PERSPECTIVE VIEW", "http://localhost:3000/img/test/view.webp"],
      ["LOCATION", "http://localhost:3000/img/test/map.jpeg"],
      ["SITE PLAN", "http://localhost:3000/img/test/plan.jpeg"],
    ].forEach(([tit, img], i) => {
      const [x, w] = [_S.M2 + i * (_E._1.W + _S.M1), _E._1.W];
      let y = _E._1.Y;
      (
        [
          ["Text", tit, { margin: 0, fontSize: _S.FONT.SIZE.M }],
          ["Shape", "rect", { fill: { color: _S.COLOR.BLACK } }],
          ["Image", null, { path: img }],
        ] as const
      ).forEach(([type, value, p], idx) => {
        const h = _E._1.H[idx];
        const prop = { x, y, w, h, ...p };

        if (type === "Image") {
          slide.addImage(prop);
        } else {
          slide[`add${type}`](value as any, prop);
        }

        y += h + 5 * _S.PX;
      });
    });

    slide.addText("GENERAL INFORMATION", {
      margin: 0,
      fontSize: _S.FONT.SIZE.M,
    });

    slide.addTable(
      [
        [
          { text: "소재지", options: {} },
          { text: "경기도 부천시 원미구 중동 1234-56", options: {} },
        ],
        [
          { text: "대지면적", options: {} },
          { text: "1,234평", options: {} },
        ],
      ],
      {
        x: _S.M2,
        w: (_S.WIDTH - (2 * _S.M2 + _S.M1)) / 2,
        y: _S.HEIGHT / 2,
        colW: [],
      }
    );

    // slide.addText("1-1. 테스트 센터", {
    //   x: _S.M2,
    //   y: _E._2.Y,
    //   margin: 0,
    //   fontSize: _S.FONT.SIZE.M,
    // });

    //slide.addText(title, { x, y, w, h, margin: 0, fontSize: _S.FONT.SIZE.M });
    // slide.addShape("upArrow", {
    //   x: 0,
    //   y: 0,
    //   w: 5,
    //   h: 3,
    //   fill: {
    //     color: _S.COLOR.BLACK,
    //   },
    //   line: {
    //     color: _S.COLOR.GM,
    //     dashType: "solid",
    //   },
    // });
    //slide.addImage({ path: img, x, y, w, h });

    // slide.addImage({
    //   path: "https://upload.wikimedia.org/wikipedia/ko/thumb/a/a6/Pok%C3%A9mon_Pikachu_art.png/200px-Pok%C3%A9mon_Pikachu_art.png",
    //   x: size(16),
    //   y: size(100),
    //   w: size(P.SIZE.WIDTH - 32),
    //   h: size(40),
    // });

    // slide.newAutoPagedSlides.forEach((slide) => slide.addText("Auto-Paging table continued...", { placeholder: "footer" }));

    // console.log("pptx._slides[0]", pptx); //._slides[0]

    // const addTextToSlide = (
    //   text: string,
    //   options: pptxgen.TextPropsOptions
    // ) => {
    //   slide.addText(text, options);
    // };

    // const processElement = (el: React.ReactNode, x = 1, y = 1): number => {
    //   if (typeof el === "string") {
    //     addTextToSlide(el, { x, y, fontSize: 18, color: "000000" });
    //     return 0.75;
    //   } else if (React.isValidElement(el)) {
    //     const { type, props } = el;
    //     if (type === "div") {
    //       let newY = y;
    //       React.Children.forEach(props.children, (child) => {
    //         newY += processElement(child, x, newY);
    //       });
    //       return newY - y;
    //     } else if (type === "h1") {
    //       console.log("h1", props.style?.color);
    //       addTextToSlide(props.children, {
    //         x,
    //         y,
    //         fontSize: 24,
    //         color: props.style?.color || "000000",
    //         bold: true,
    //       });
    //       return 0.75;
    //     } else if (type === "p") {
    //       addTextToSlide(props.children, {
    //         x,
    //         y,
    //         fontSize: 18,
    //         color: props.style?.color || "000000",
    //       });
    //       return 0.75;
    //     } else if (type === "table") {
    //       let newY = y;
    //       React.Children.forEach(props.children, (child) => {
    //         newY += processElement(child, x, newY);
    //       });
    //       return newY - y;
    //     } else if (type === "tbody") {
    //       let newY = y;
    //       React.Children.forEach(props.children, (child) => {
    //         newY += processElement(child, x, newY);
    //       });
    //       return newY - y;
    //     } else if (type === "tr") {
    //       let newX = x;
    //       let maxHeight = 0;
    //       React.Children.forEach(props.children, (child) => {
    //         const height = processElement(child, newX, y);
    //         maxHeight = Math.max(maxHeight, height);
    //         newX += 1.5; // Adjust spacing between cells
    //       });
    //       return maxHeight;
    //     } else if (type === "td") {
    //       addTextToSlide(props.children, {
    //         x,
    //         y,
    //         fontSize: 18,
    //         color: props.style?.color || "000000",
    //         margin: 0.1, // Adjust cell margin
    //       });
    //       return 0.75;
    //     }
    //   }
    //   return 0;
    // };

    // if (Array.isArray(html)) {
    //   html.forEach((element, index) => {
    //     processElement(element, 1, 1 + index);
    //   });
    // } else {
    //   processElement(html);
    // }

    pptx.writeFile({ fileName: `${title || _P.NAME}_${Date.now()}.pptx` });
  };

  return (
    <div id="ppt">
      <ul>
        <li>
          <span>타이틀</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </li>
        <li>
          <button onClick={generatePpt}>Export to PPT</button>
        </li>
      </ul>
    </div>
  );
};

export default PPT;
