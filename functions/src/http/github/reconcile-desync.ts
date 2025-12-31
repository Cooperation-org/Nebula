/**
 * HTTP Endpoint: Reconcile GitHub Desync
 * 
 * Provides HTTP endpoint for detecting and reconciling desync
 * between GitHub and Toolkit state
 * 
 * Story 7.7: Reconcile Desync Between GitHub and Toolkit
 */

import { onRequest } from 'firebase-functions/v2/https'
import { logger } from '../../shared/logger'
import { detectDesync, reconcileDesync } from './github-desync-detector'
import { getFirestore } from 'firebase-admin/firestore'

const db = getFirestore()

/**
 * HTTP endpoint to detect desync for a specific task
 * GET /reconcile-desync?teamId={teamId}&taskId={taskId}
 */
export const detectTaskDesync = onRequest(
  {
    cors: true,
    maxInstances: 10
  },
  async (request, response) => {
    try {
      const teamId = request.query.teamId as string
      const taskId = request.query.taskId as string

      if (!teamId || !taskId) {
        response.status(400).json({
          error: 'Missing required parameters: teamId and taskId'
        })
        return
      }

      // Get task from Firestore
      const taskDoc = await db
        .collection('teams')
        .doc(teamId)
        .collection('tasks')
        .doc(taskId)
        .get()

      if (!taskDoc.exists) {
        response.status(404).json({ error: 'Task not found' })
        return
      }

      const task = taskDoc.data()
      if (!task || !task.github) {
        response.status(400).json({ error: 'Task does not have GitHub integration' })
        return
      }

      // Detect desync
      const detection = await detectDesync(teamId, taskId, task.github)

      if (!detection) {
        response.status(500).json({ error: 'Failed to detect desync' })
        return
      }

      response.status(200).json({
        desync: detection.isDesynced,
        detection
      })
    } catch (error) {
      logger.error('Error in detectTaskDesync endpoint', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      response.status(500).json({
        error: 'Internal server error'
      })
    }
  }
)

/**
 * HTTP endpoint to reconcile desync for a specific task
 * POST /reconcile-desync
 * Body: { teamId: string, taskId: string }
 */
export const reconcileTaskDesync = onRequest(
  {
    cors: true,
    maxInstances: 10
  },
  async (request, response) => {
    try {
      const { teamId, taskId } = request.body

      if (!teamId || !taskId) {
        response.status(400).json({
          error: 'Missing required parameters: teamId and taskId'
        })
        return
      }

      // Get task from Firestore
      const taskDoc = await db
        .collection('teams')
        .doc(teamId)
        .collection('tasks')
        .doc(taskId)
        .get()

      if (!taskDoc.exists) {
        response.status(404).json({ error: 'Task not found' })
        return
      }

      const task = taskDoc.data()
      if (!task || !task.github) {
        response.status(400).json({ error: 'Task does not have GitHub integration' })
        return
      }

      // Detect desync first
      const detection = await detectDesync(teamId, taskId, task.github)

      if (!detection) {
        response.status(500).json({ error: 'Failed to detect desync' })
        return
      }

      if (!detection.isDesynced) {
        response.status(200).json({
          message: 'No desync detected - states are in sync',
          detection
        })
        return
      }

      // Reconcile desync (sync Toolkit state to GitHub)
      const success = await reconcileDesync(teamId, taskId, task.github)

      if (success) {
        response.status(200).json({
          message: 'Desync reconciled successfully',
          detection,
          reconciled: true
        })
      } else {
        response.status(500).json({
          error: 'Failed to reconcile desync',
          detection
        })
      }
    } catch (error) {
      logger.error('Error in reconcileTaskDesync endpoint', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      response.status(500).json({
        error: 'Internal server error'
      })
    }
  }
)

