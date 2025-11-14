import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Card from '../components/ui/Card';
import { TableWrap, Table, THead, TH, TR, TD } from '../components/ui/Table';

type Post = {
  id: string;
  postDate: string;
  postDay: string;
  picTalentId?: string;
  picEditorId?: string;
  picPostingId?: string;
  contentCategory: string;
  adsOnMusic: boolean;
  yellowCart: boolean;
  postTitle: string;
  contentType: string;
  status: string;
  contentLink?: string;
  totalView: number;
  totalLike: number;
  totalComment: number;
  totalShare: number;
  totalSaved: number;
  engagementRate: number;
};

export default function PostsPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api(`/campaigns/${id}/posts`, { token })
      .then(setPosts)
      .finally(() => setLoading(false));
  }, [id, token]);

  return (
    <div>
      <div className="mb-3"><h2 className="page-title">Posts</h2></div>
      {loading ? (
        <div className="skeleton h-10 w-full" />
      ) : (
        <Card>
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>NO</TH>
                  <TH>Hari Posting</TH>
                  <TH>Tanggal Posting</TH>
                  <TH>Judul</TH>
                  <TH>Jenis</TH>
                  <TH>Kategori Konten</TH>
                  <TH>Ads on Music</TH>
                  <TH>Keranjang Kuning</TH>
                  <TH>TOTAL VIEW</TH>
                  <TH>LIKE</TH>
                  <TH>COMMENT</TH>
                  <TH>SHARE</TH>
                  <TH>SAVED</TH>
                  <TH>Engagement Rate</TH>
                </TR>
              </THead>
              <tbody>
                {posts.map((p, i) => (
                  <TR key={p.id}>
                    <TD>{i + 1}</TD>
                    <TD>{p.postDay}</TD>
                    <TD>{new Date(p.postDate).toLocaleDateString()}</TD>
                    <TD>{p.postTitle}</TD>
                    <TD>{p.contentType}</TD>
                    <TD>{p.contentCategory}</TD>
                    <TD>{p.adsOnMusic ? 'Yes' : 'No'}</TD>
                    <TD>{p.yellowCart ? 'Yes' : 'No'}</TD>
                    <TD>{p.totalView}</TD>
                    <TD>{p.totalLike}</TD>
                    <TD>{p.totalComment}</TD>
                    <TD>{p.totalShare}</TD>
                    <TD>{p.totalSaved}</TD>
                    <TD>{(p.engagementRate * 100).toFixed(2)}%</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      )}
    </div>
  );
}
