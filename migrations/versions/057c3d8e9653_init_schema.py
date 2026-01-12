"""init schema

Revision ID: 057c3d8e9653
Revises: 
Create Date: 2026-01-07 11:06:34.845144

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '057c3d8e9653'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Fresh create of sessions table (works on empty DBs)
    op.create_table(
        'sessions',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('status', sa.String(length=20), nullable=False, default='active'),
        sa.Column('raw_initial_text', sa.Text(), nullable=True),
        sa.Column('history', sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column('active_domains', sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column('filled_slots', sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column('meta', sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column('popups', sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )


def downgrade():
    op.drop_table('sessions')
