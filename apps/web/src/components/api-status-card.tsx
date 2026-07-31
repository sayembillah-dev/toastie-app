'use client';

import { ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Tag } from 'antd';
import { useState, useTransition } from 'react';

import { apiFetch, type Greeting } from '@/lib/api';

interface Props {
  initialData: Greeting | null;
  initialError: string | null;
}

export function ApiStatusCard({ initialData, initialError }: Props) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState(initialError);
  const [isPending, startTransition] = useTransition();

  // The first result is fetched on the server, so there is no effect here —
  // this only runs when the user asks for a refresh.
  function refresh() {
    startTransition(async () => {
      try {
        setData(await apiFetch<Greeting>());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setData(null);
      }
    });
  }

  return (
    <Card
      title="Backend connection"
      extra={
        <Button icon={<ReloadOutlined />} onClick={refresh} loading={isPending}>
          Refresh
        </Button>
      }
    >
      {error ? (
        <Alert
          type="error"
          showIcon
          message="Could not reach the API"
          description={`${error} — is the NestJS app running on port 4000?`}
        />
      ) : (
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Status">
            <Tag color="success">connected</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Message">{data?.message}</Descriptions.Item>
          <Descriptions.Item label="Service">{data?.service}</Descriptions.Item>
          <Descriptions.Item label="Timestamp">{data?.timestamp}</Descriptions.Item>
        </Descriptions>
      )}
    </Card>
  );
}
