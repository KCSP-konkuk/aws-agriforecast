import Layout from '../components/Layout';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '../api/api';

export default function Community() {
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [posts, setPosts] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const categories = ['전체', '도매정보', '소매노하우', '구인구직', '자유게시판'];

  useEffect(() => {
    loadPosts();
  }, [selectedCategory, currentPage]);

  const loadPosts = async () => {
    try {
      setLoading(true);
      setError('');
      
      let response;
      if (selectedCategory === '전체') {
        response = await api.getPosts(currentPage, 10);
      } else {
        response = await api.getPostsByCategory(selectedCategory, currentPage, 10);
      }
      
      setPosts(response.content || []);
      setTotalPages(response.totalPages || 1);
    } catch (err) {
      console.error('게시글 로드 실패:', err);
      console.error('에러 상세:', err.message, err.stack);
      // 네트워크 에러인 경우와 서버 에러를 구분
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        setError('서버에 연결할 수 없습니다. BackEnd 서버가 실행 중인지 확인해주세요.');
      } else {
        setError('게시글을 불러오는데 실패했습니다: ' + err.message);
      }
      setPosts([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  return (
    <Layout>
      <main className="px-40 flex flex-1 justify-center py-5">
        <div className="layout-content-container flex flex-col max-w-[960px] flex-1">
          {/* PageHeading Start */}
          <div className="flex flex-wrap justify-between gap-3 p-4">
            <div className="flex min-w-72 flex-col gap-3">
              <p className="text-[#131b0e] text-4xl font-black leading-tight tracking-[-0.033em]">커뮤니티 게시판</p>
              <p className="text-[#6d974e] text-base font-normal leading-normal">농산물 도소매상들을 위한 정보 공유 및 소통 공간입니다.</p>
            </div>
          </div>
          {/* PageHeading End */}
          
          {/* Chips Start */}
          <div className="flex gap-3 p-3 overflow-x-hidden border-b border-solid border-b-[#ecf3e7]">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => {
                  setSelectedCategory(category);
                  setCurrentPage(0);
                }}
                className={`flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-lg pl-4 pr-4 ${
                  selectedCategory === category
                    ? 'bg-[#64cf17]'
                    : 'bg-[#ecf3e7] hover:bg-[#d9e7d0]'
                }`}
              >
                <p className={`text-[#131b0e] text-sm ${
                  selectedCategory === category ? 'font-bold' : 'font-medium'
                } leading-normal`}>
                  {category}
                </p>
              </button>
            ))}
          </div>
          {/* Chips End */}
          
          {/* ToolBar Start */}
          <div className="flex justify-between gap-2 px-4 py-3">
            <div className="flex gap-2">
              <button className="p-2 text-[#131b0e] rounded-lg hover:bg-[#ecf3e7]">
                <span className="material-symbols-outlined" style={{fontSize: '24px'}}>sort</span>
              </button>
            </div>
            <Link to="/community/write" className="flex max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 bg-[#64cf17] text-[#131b0e] gap-2 text-sm font-bold leading-normal tracking-[0.015em] min-w-0 px-4 hover:bg-opacity-80">
              <span className="material-symbols-outlined" style={{fontSize: '20px'}}>edit</span>
              <span className="truncate">글쓰기</span>
            </Link>
          </div>
          {/* ToolBar End */}
          
          {/* Error Message */}
          {error && (
            <div className="px-4 py-2 mx-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
          
          {/* Table Start */}
          <div className="px-4 py-3 @container">
            {loading ? (
              <div className="text-center py-10 text-[#6d974e]">로딩 중...</div>
            ) : posts.length === 0 ? (
              <div className="text-center py-10 text-[#6d974e]">게시글이 없습니다.</div>
            ) : (
              <div className="flex overflow-hidden rounded-lg border border-[#d9e7d0] bg-[#fafcf8]">
                <table className="flex-1">
                  <thead>
                    <tr className="bg-[#fafcf8]">
                      <th className="px-4 py-3 text-left text-[#131b0e] w-[45%] text-sm font-medium leading-normal">제목</th>
                      <th className="px-4 py-3 text-left text-[#131b0e] w-[15%] text-sm font-medium leading-normal">작성자</th>
                      <th className="px-4 py-3 text-left text-[#131b0e] w-[15%] text-sm font-medium leading-normal">작성일</th>
                      <th className="px-4 py-3 text-left text-[#131b0e] w-[10%] text-sm font-medium leading-normal">조회수</th>
                      <th className="px-4 py-3 text-left text-[#131b0e] w-[15%] text-sm font-medium leading-normal">댓글 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((post) => (
                      <tr key={post.id} className="border-t border-t-[#d9e7d0] hover:bg-[#ecf3e7] cursor-pointer">
                        <td className="h-[72px] px-4 py-2 w-[45%] text-[#131b0e] text-sm font-normal leading-normal">
                          <Link to={`/community/${post.id}`} className="block">
                            {post.title}
                          </Link>
                        </td>
                        <td className="h-[72px] px-4 py-2 w-[15%] text-[#6d974e] text-sm font-normal leading-normal">
                          {post.authorName || '익명'}
                        </td>
                        <td className="h-[72px] px-4 py-2 w-[15%] text-[#6d974e] text-sm font-normal leading-normal">
                          {formatDate(post.createdAt)}
                        </td>
                        <td className="h-[72px] px-4 py-2 w-[10%] text-[#6d974e] text-sm font-normal leading-normal">
                          {post.viewCount || 0}
                        </td>
                        <td className="h-[72px] px-4 py-2 w-[15%] text-[#6d974e] text-sm font-normal leading-normal">
                          {post.commentCount || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {/* Table End */}
          
          {/* Pagination Start */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 p-4 mt-4">
              <button
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#131b0e] hover:bg-[#ecf3e7] disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(10, totalPages) }, (_, i) => {
                const pageNum = i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${
                      currentPage === pageNum
                        ? 'bg-[#64cf17] text-[#131b0e] font-bold'
                        : 'text-[#131b0e] hover:bg-[#ecf3e7]'
                    }`}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
              {totalPages > 10 && <span className="text-[#6d974e]">...</span>}
              <button
                onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage >= totalPages - 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#131b0e] hover:bg-[#ecf3e7] disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
          )}
          {/* Pagination End */}
        </div>
      </main>
    </Layout>
  );
}
