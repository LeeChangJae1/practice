import React, { useEffect, useState } from "react";
import axios from "axios";

interface IData {
  _id: string;
  districtName: string;
  department?: string;
  title: string;
  link?: string;
  startDate?: string;
  endDate?: string;
  files?: { url: string; name: string }[];
}

const CRAWL: React.FC = () => {
  const [loading, setLoading] = useState<boolean | null>(null);
  const [districts, setDistricts] = useState<string[] | null>(null);
  const [keywords, setKeywords] = useState<string[] | null>(null);
  const [customKeyword, setCustomKeyword] = useState("");
  const [responseData, setResponseData] = useState<IData[] | null>(null);
  const [errors, setErrors] = useState<string[] | null>(null);
  const [isRequestAction, setIsRequestAction] = useState(false);
  const [isOnlyHasFile, setIsOnlyHasFile] = useState(false);
  const [resultTitle, setResultTitle] = useState("");

  useEffect(() => {
    if (isRequestAction) {
      setResponseData(null);
      setErrors(null);
      const fetchTitles = async () => {
        try {
          setLoading(true);
          const response = await axios.get("http://localhost:9000/api", {
            params: {
              districts: districts?.join("|"),
              keywords: [
                ...(keywords || []),
                ...(customKeyword ? [customKeyword] : []),
              ]?.join("|"),
            },
          });

          console.log(response.data);

          const { results, errorUrls } = response.data;
          setResponseData(results);
          if (errorUrls?.length > 0) {
            setErrors(errorUrls);
          }
        } catch (error) {
          //   alert("에러 발생!");
          console.log("error", error);
          setIsRequestAction(false);
          setLoading(false);
        }
      };

      fetchTitles();
    }
  }, [isRequestAction]);

  useEffect(() => {
    if (responseData) {
      setResultTitle(
        `[지역: ${districts ? districts.join(", ") : "전체"}] & [키워드: ${
          (keywords && keywords?.length > 0) || customKeyword
            ? [
                ...(keywords || []),
                ...(customKeyword ? [customKeyword] : []),
              ].join("/")
            : "없음(최신글)"
        }]`
      );
      setIsRequestAction(false);
      setLoading(false);
    }
  }, [responseData]);

  return (
    <div id="crawl">
      <h1>지역구별 고시/공고 데이터 크롤링</h1>
      {!loading ? (
        <div className="option">
          {[
            { key: "ALL", label: "전체" },
            { key: "JUNGGU", label: "중구" },
            { key: "JONGROGU", label: "종로구" },
            { key: "GANGNAMGU", label: "강남구" },
            { key: "YONGSANGU", label: "용산구" },
            { key: "SEOCHOGU", label: "서초구" },
            { key: "BUNDANGGU", label: "분당구" },
          ].map(({ key, label }) => {
            const checked =
              key === "ALL"
                ? !districts || districts.length === 0
                : !!districts?.includes(key);

            return (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setDistricts((prev) =>
                      key === "ALL"
                        ? null
                        : checked
                        ? [...(prev || [])].filter((d) => d !== key)
                        : [...(prev || [])].concat(key)
                    )
                  }
                />
                <span>{label}</span>
              </label>
            );
          })}
          <br />
          {[
            "없음",
            "재개발",
            "재정비",
            "사업시행계획",
            "지구단위계획",
            "안전점검",
            "건설",
            "건축",
          ].map((keyword) => {
            const checked =
              keyword === "없음"
                ? !keywords || keywords.length === 0
                : !!keywords?.includes(keyword);

            return (
              <label key={keyword}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setKeywords((prev) =>
                      keyword === "없음"
                        ? null
                        : checked
                        ? [...(prev || [])].filter((k) => k !== keyword)
                        : [...(prev || [])].concat(keyword)
                    )
                  }
                />
                <span className="keyword">
                  {keyword}
                  {keyword === "없음" ? "(최신글)" : ""}
                </span>
              </label>
            );
          })}
          <input
            type="text"
            className={`custom ${customKeyword ? "active" : ""}`}
            placeholder="검색 키워드 직접 입력"
            value={customKeyword}
            onChange={(e) => setCustomKeyword(e.target.value)}
          />
          <br />
          <button onClick={() => setIsRequestAction(true)}>
            지역구별 고시/공고 데이터 크롤링 실행
          </button>
        </div>
      ) : null}

      {responseData ? (
        <div className="results">
          <h2>
            {resultTitle} 검색 결과 (총&nbsp;
            {responseData.filter(
              (d) => !isOnlyHasFile || (d.files && d.files?.length > 0)
            ).length || 0}
            건)
          </h2>
          <label className="has-file">
            <input
              type="checkbox"
              checked={isOnlyHasFile}
              onChange={(e) => setIsOnlyHasFile(e.target.checked)}
            />
            <span>첨부파일이 없는 데이터 제외</span>
          </label>
          <ul className="list">
            {responseData.length > 0
              ? [...responseData]
                  .filter(
                    (d) => !isOnlyHasFile || (d.files && d.files?.length > 0)
                  )
                  .sort(
                    (a, b) =>
                      (b.startDate ? new Date(b.startDate).getTime() : -1) -
                        (a.startDate ? new Date(a.startDate).getTime() : -1) ||
                      (a.endDate && b.endDate
                        ? (a.endDate ? new Date(a.endDate).getTime() : -1) -
                          (b.endDate ? new Date(b.endDate).getTime() : -1)
                        : -1)
                  )
                  .map((item) => (
                    <li key={item._id}>
                      <p className="title">
                        <span className={`district ${item._id.split("-")[0]}`}>
                          {item.districtName}
                          {item.department ? (
                            <span>{item.department}</span>
                          ) : null}
                        </span>
                        <a href={item.link} target="_blank">
                          {item.title}
                          {item.startDate || item.endDate ? (
                            <em>
                              {item.startDate || ""} ~ {item.endDate || ""}
                            </em>
                          ) : null}
                        </a>
                      </p>
                      <ul className="files">
                        {item.files?.map((file, idx) => (
                          <li key={`${item._id}-file-${idx}`}>
                            <a href={file.url} target="_blank">
                              {file.name
                                ? file.name.replace(" 파일 다운로드", "")
                                : "첨부파일"}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))
              : null}
          </ul>
        </div>
      ) : null}

      {errors && errors.length > 0 ? (
        <div className="errors">
          <h2>크롤링 실패 URL (총 {errors.length}건)</h2>
          {errors.map((err) => (
            <a href={err} target="_blank">
              {err}
            </a>
          ))}
        </div>
      ) : null}

      {loading ? <h3 className="loading">크롤링 진행중...</h3> : null}
    </div>
  );
};

export default CRAWL;
